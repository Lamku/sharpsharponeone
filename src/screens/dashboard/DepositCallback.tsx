import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { notifyDeposit } from '@/lib/telegram';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { verifyPayment } from '@/lib/paystack';
import { formatNaira } from '@/lib/format';

export const DepositCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('Verifying your payment...');
  const [amount, setAmount] = useState<number>(0);

  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) {
      setStatus('failed');
      setMessage('No payment reference found.');
      return;
    }

    (async () => {
      try {
        // ==================================================
        // STEP 1: Verify payment with Paystack
        // ==================================================
        const result = await verifyPayment(reference);
        console.log('[DepositCallback] verify result:', result);

        if (!result.success || !result.userId) {
          setStatus('failed');
          setMessage(result.message || 'Payment verification failed.');
          return;
        }

        const paidAmount = result.amount || 0;
        const userId = result.userId;
        setAmount(paidAmount);

        // ==================================================
        // STEP 2: Find the paystack_refs record
        // ==================================================
        let refDocId: string | null = null;
        let txId: string | null = null;
        let alreadyCredited = false;

        try {
          const refQuery = query(
            collection(db, 'paystack_refs'),
            where('reference', '==', reference),
            where('user_id', '==', userId)
          );
          const refSnap = await getDocs(refQuery);
          console.log('[DepositCallback] paystack_refs found:', refSnap.size);

          if (!refSnap.empty) {
            const refData = refSnap.docs[0].data();
            refDocId = refSnap.docs[0].id;
            txId = refData.transaction_id as string;
            alreadyCredited = !!refData.credited;
          }
        } catch (refErr) {
          console.warn('[DepositCallback] Could not read paystack_refs:', refErr);
        }

        // ==================================================
        // STEP 3: Mark transaction successful (best-effort)
        // ==================================================
        if (txId) {
          try {
            await updateDoc(doc(db, 'transactions', txId), {
              status: 'successful',
              verified_at: serverTimestamp(),
            });
            console.log('[DepositCallback] Transaction marked successful:', txId);
          } catch (txErr) {
            console.warn('[DepositCallback] Could not update transaction:', txErr);
          }
        }

        // ==================================================
        // STEP 4: Credit user's wallet (idempotent)
        // ==================================================
        if (!alreadyCredited) {
          await creditUser(userId, paidAmount, reference);
          console.log('[DepositCallback] User credited:', paidAmount);

          if (refDocId) {
            try {
              await updateDoc(doc(db, 'paystack_refs', refDocId), {
                credited: true,
                credited_at: serverTimestamp(),
              });
            } catch (markErr) {
              console.warn('[DepositCallback] Could not mark ref credited:', markErr);
            }
          }

          // ⭐ STEP 4B: Pay 40% referral commission (once per referred user)
          try {
            const refResult = await payReferralCommission(userId, paidAmount);
            if (refResult.paid) {
              console.log(
                `[DepositCallback] ✅ Referral: ₦${refResult.commission} → ${refResult.referrerId}`
              );
            } else {
              console.log(`[DepositCallback] Referral skipped: ${refResult.reason}`);
            }
          } catch (refErr) {
            console.warn('[DepositCallback] Referral payout failed (non-fatal):', refErr);
          }
            // ⭐ Telegram — notify admin of successful deposit
          try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            const userData = userSnap.exists() ? userSnap.data() : null;
            await notifyDeposit({
              userName: userData?.full_name || 'Unknown',
              userPhone: userData?.phone || 'N/A',
              amount: paidAmount,
              reference,
              method: 'paystack',
            });
          } catch (tErr) {
            console.warn('[DepositCallback] Telegram notify failed:', tErr);
          }


        } else {
          console.log('[DepositCallback] Already credited — skipping');
        }

        // ==================================================
        // STEP 5: Success
        // ==================================================
        setStatus('success');
        setMessage(`₦${paidAmount.toLocaleString()} credited to your wallet.`);
      } catch (err: any) {
        console.error('[DepositCallback] Fatal error:', err);
        console.error('[DepositCallback] Error code:', err?.code);
        console.error('[DepositCallback] Error message:', err?.message);
        setStatus('failed');
        setMessage(
          `Payment received but crediting failed: ${err?.message || 'Unknown error'}. Please contact support with ref: ${reference}`
        );
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="glass-card p-6 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="text-emerald-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-bold text-white mb-2">Verifying Payment</h2>
            <p className="text-sm text-slate-400">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-sm text-emerald-400 font-semibold mb-1">{formatNaira(amount)}</p>
            <p className="text-sm text-slate-400 mb-5">{message}</p>
            <button onClick={() => navigate('/app/products')} className="btn-emerald w-full py-3 text-sm">
              Back to Dashboard
            </button>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Payment Issue</h2>
            <p className="text-sm text-slate-400 mb-5">{message}</p>
            <button onClick={() => navigate('/app/products')} className="btn-ghost w-full py-3 text-sm">
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ==================================================
// CREDIT USER — atomic wallet credit + one notification
// ==================================================
async function creditUser(userId: string, amount: number, reference: string) {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error('User not found');

    const userData = userSnap.data();
    transaction.update(userRef, {
      wallet_balance: (userData.wallet_balance || 0) + amount,
      portfolio_value: (userData.portfolio_value || 0) + amount,
    });
  });

  try {
    await addDoc(collection(db, 'notifications'), {
      user_id: userId,
      title: '✅ Deposit Successful',
      message: `Your deposit of ₦${amount.toLocaleString()} has been credited to your wallet (ref: ${reference}).`,
      type: 'success',
      read: false,
      created_at: serverTimestamp(),
    });
  } catch (notifErr) {
    console.warn('[DepositCallback] Notification failed (non-fatal):', notifErr);
  }
}

// ==================================================
// ⭐ PAY REFERRAL COMMISSION — 40% once per referred user
// ==================================================
async function payReferralCommission(
  referredUserId: string,
  depositAmount: number
): Promise<{ paid: boolean; commission?: number; referrerId?: string; reason?: string }> {
  try {
    if (depositAmount <= 0) return { paid: false, reason: 'Zero deposit' };

    const referredUserRef = doc(db, 'users', referredUserId);
    const referredUserSnap = await getDoc(referredUserRef);
    if (!referredUserSnap.exists()) return { paid: false, reason: 'User not found' };

    const referredData = referredUserSnap.data();
    const referrerCode = referredData?.referred_by;

    if (!referrerCode) return { paid: false, reason: 'No referrer' };
    if (referredData?.referral_commission_paid) return { paid: false, reason: 'Already paid' };

    const q = query(collection(db, 'users'), where('referral_code', '==', referrerCode));
    const snap = await getDocs(q);
    if (snap.empty) return { paid: false, reason: 'Referrer not found' };

    const referrerId = snap.docs[0].id;
    const referrerRef = doc(db, 'users', referrerId);

    const commission = depositAmount * 0.4;

    await runTransaction(db, async (transaction) => {
      const freshReferred = await transaction.get(referredUserRef);
      if (!freshReferred.exists()) throw new Error('Referred user missing');
      if (freshReferred.data()?.referral_commission_paid) {
        throw new Error('ALREADY_PAID');
      }

      const freshReferrer = await transaction.get(referrerRef);
      if (!freshReferrer.exists()) throw new Error('Referrer missing');

      const referrerData = freshReferrer.data();

      transaction.update(referrerRef, {
        wallet_balance: (referrerData?.wallet_balance || 0) + commission,
        portfolio_value: (referrerData?.portfolio_value || 0) + commission,
        total_referral_earnings: (referrerData?.total_referral_earnings || 0) + commission,
      });

      transaction.update(referredUserRef, {
        referral_commission_paid: true,
        referral_commission_amount: commission,
        referral_commission_paid_at: serverTimestamp(),
      });

      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        user_id: referrerId,
        amount: commission,
        type: 'referral',
        description: '40% referral commission from a referred user deposit',
        status: 'successful',
        created_at: serverTimestamp(),
      });

      const notifRef = doc(collection(db, 'notifications'));
      transaction.set(notifRef, {
        user_id: referrerId,
        title: '💰 Referral Commission Earned',
        message: `You earned ₦${commission.toLocaleString()} (40%) from a referred user's deposit.`,
        type: 'referral',           // ⭐ changed from 'success'
        read: false,
        created_at: serverTimestamp(),
      });
    });

    return { paid: true, commission, referrerId };
  } catch (err: any) {
    if (err?.message === 'ALREADY_PAID') {
      return { paid: false, reason: 'Already paid' };
    }
    console.error('payReferralCommission error:', err);
    return { paid: false, reason: err?.message || 'Unknown error' };
  }
}