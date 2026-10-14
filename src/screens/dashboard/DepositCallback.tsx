import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { notifyDeposit } from '@/lib/telegram';
import { payReferralCommission } from '@/lib/referral';
import {
  collection, query, where, getDocs, getDoc, updateDoc, doc,
  addDoc, serverTimestamp, runTransaction,
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
        const result = await verifyPayment(reference);
        console.log('[DepositCallback] verify result:', result);

        if (!result.success) {
          setStatus('failed');
          setMessage(result.message || 'Payment verification failed.');
          return;
        }

        const paidAmount = result.amount || 0;
        let userId = result.userId || null;
        let intentId: string | null = null;

        if (!userId) {
          console.log('[DepositCallback] No userId from Paystack — looking up intent');
          try {
            let sessionUserId: string | null = null;
            try { sessionUserId = sessionStorage.getItem('deposit_intent_user'); } catch {}

            if (sessionUserId) {
              userId = sessionUserId;
              console.log('[DepositCallback] Recovered userId from sessionStorage:', userId);
            } else {
              const intentQuery = query(collection(db, 'deposit_intents'), where('used', '==', false));
              const intentSnap = await getDocs(intentQuery);

              if (!intentSnap.empty) {
                const sorted = intentSnap.docs
                  .map((d) => ({ id: d.id, ...d.data() }))
                  .sort((a: any, b: any) => {
                    const at = a.created_at?.toDate?.()?.getTime?.() || 0;
                    const bt = b.created_at?.toDate?.()?.getTime?.() || 0;
                    return bt - at;
                  });
                userId = (sorted[0] as any).user_id as string;
                intentId = sorted[0].id as string;
                console.log('[DepositCallback] Recovered userId from Firestore intent:', userId);
              }
            }
          } catch (intentErr) {
            console.warn('[DepositCallback] Intent lookup failed:', intentErr);
          }
        }

        if (!userId) {
          setStatus('failed');
          setMessage('Could not determine which user this payment belongs to. Please contact support with your Paystack reference.');
          return;
        }

        setAmount(paidAmount);

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

        if (!alreadyCredited) {
          try {
            const txQuery = query(
              collection(db, 'transactions'),
              where('reference', '==', reference),
              where('type', '==', 'deposit')
            );
            const txSnap = await getDocs(txQuery);
            if (!txSnap.empty) {
              const txData = txSnap.docs[0].data();
              if (txData.status === 'successful' && txData.credited === true) {
                alreadyCredited = true;
                console.log('[DepositCallback] Already credited (found in transactions)');
              }
            }
          } catch (dupErr) {
            console.warn('[DepositCallback] Duplicate check failed:', dupErr);
          }
        }

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

          if (intentId) {
            try {
              await updateDoc(doc(db, 'deposit_intents', intentId), {
                used: true,
                used_at: serverTimestamp(),
                reference,
              });
            } catch (markErr) {
              console.warn('[DepositCallback] Could not mark intent used:', markErr);
            }
          }

          try {
            sessionStorage.removeItem('deposit_intent_user');
            sessionStorage.removeItem('deposit_intent_time');
          } catch {}

          try {
            const refResult = await payReferralCommission(userId, paidAmount);
            if (refResult.paid) {
              console.log(`[DepositCallback] ✅ Referral: ₦${refResult.commission} → ${refResult.referrerId}`);
            } else {
              console.log(`[DepositCallback] Referral skipped: ${refResult.reason}`);
            }
          } catch (refErr) {
            console.warn('[DepositCallback] Referral payout failed (non-fatal):', refErr);
          }

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

        setStatus('success');
        setMessage(`₦${paidAmount.toLocaleString()} credited to your wallet.`);
      } catch (err: any) {
        console.error('[DepositCallback] Fatal error:', err);
        console.error('[DepositCallback] Error code:', err?.code);
        console.error('[DepositCallback] Error message:', err?.message);
        setStatus('failed');
        setMessage(`Payment received but crediting failed: ${err?.message || 'Unknown error'}. Please contact support with ref: ${reference}`);
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="glass-card p-6 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="text-[#00A04A] mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-bold text-[#0A2A1A] mb-2">Verifying Payment</h2>
            <p className="text-sm text-[#4A5A50]">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={48} className="text-[#00A04A] mx-auto mb-4" />
            <h2 className="text-lg font-bold text-[#0A2A1A] mb-2">Payment Successful!</h2>
            <p className="text-sm text-[#00A04A] font-semibold mb-1">{formatNaira(amount)}</p>
            <p className="text-sm text-[#4A5A50] mb-5">{message}</p>
            <button onClick={() => navigate('/app/products')} className="btn-emerald w-full py-3 text-sm">
              Back to Dashboard
            </button>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-[#0A2A1A] mb-2">Payment Issue</h2>
            <p className="text-sm text-[#4A5A50] mb-5">{message}</p>
            <button onClick={() => navigate('/app/products')} className="btn-ghost w-full py-3 text-sm">
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ==========================================
// creditUser — kept local (no external equivalent)
// ==========================================
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
    await addDoc(collection(db, 'transactions'), {
      user_id: userId,
      amount,
      type: 'deposit',
      method: 'paystack',
      description: 'Paystack storefront deposit',
      reference,
      status: 'successful',
      credited: true,
      created_at: serverTimestamp(),
    });
  } catch (txErr) {
    console.warn('[DepositCallback] Could not save deposit transaction:', txErr);
  }

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