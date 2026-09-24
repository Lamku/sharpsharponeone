// src/lib/referral.ts
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';

/**
 * Pay referral commission to the referrer, once per referred user.
 * Call AFTER a deposit has been credited to the referred user's wallet.
 */
export async function payReferralCommission(
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

    // Already paid? skip
    if (referredData?.referral_commission_paid) {
      return { paid: false, reason: 'Already paid' };
    }

    // Find the referrer by code
    const q = query(collection(db, 'users'), where('referral_code', '==', referrerCode));
    const snap = await getDocs(q);
    if (snap.empty) return { paid: false, reason: 'Referrer not found' };

    const referrerId = snap.docs[0].id;
    const referrerRef = doc(db, 'users', referrerId);

    // Commission calculation
    const commission = depositAmount * 0.4;

    await runTransaction(db, async (transaction) => {
      // Re-read both inside the transaction to prevent races
      const freshReferred = await transaction.get(referredUserRef);
      if (!freshReferred.exists()) throw new Error('Referred user missing');
      if (freshReferred.data()?.referral_commission_paid) {
        throw new Error('ALREADY_PAID');
      }

      const freshReferrer = await transaction.get(referrerRef);
      if (!freshReferrer.exists()) throw new Error('Referrer missing');

      const referrerData = freshReferrer.data();

      // Credit referrer's wallet + track earnings
      transaction.update(referrerRef, {
        wallet_balance: (referrerData?.wallet_balance || 0) + commission,
        portfolio_value: (referrerData?.portfolio_value || 0) + commission,
        total_referral_earnings: (referrerData?.total_referral_earnings || 0) + commission,
      });

      // Flag the referred user as paid
      transaction.update(referredUserRef, {
        referral_commission_paid: true,
        referral_commission_amount: commission,
        referral_commission_paid_at: serverTimestamp(),
      });

      // Log transaction on the referrer's account
      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        user_id: referrerId,
        amount: commission,
        type: 'referral',
        description: 'Referral commission from a referred user deposit',
        status: 'successful',
        created_at: serverTimestamp(),
      });

      // Notification for referrer
      const notifRef = doc(collection(db, 'notifications'));
      transaction.set(notifRef, {
        user_id: referrerId,
        title: '💰 Referral Commission Earned',
        message: `You earned ₦${commission.toLocaleString()} from a referred user's deposit.`,
        type: 'success',
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