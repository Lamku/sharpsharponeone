import React, { useState } from 'react';
import { CreditCard, ArrowDownToLine, Loader2, AlertCircle } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import { initializePayment } from '@/lib/paystack';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface DepositSectionProps {
  onClose?: () => void;
}

const MIN_DEPOSIT = 5000;

export const DepositSection: React.FC<DepositSectionProps> = ({ onClose }) => {
  const { profile } = useAuth();
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayWithPaystack = async () => {
    if (!amount || amount < MIN_DEPOSIT) {
      setError(`Minimum deposit is ₦${MIN_DEPOSIT.toLocaleString()}`);
      return;
    }

    // 🔑 Get email safely:
    // 1. Try Firebase Auth currentUser
    // 2. Fall back to profile (in case you store it there)
    // 3. Fall back to a generated placeholder
    const authEmail = auth.currentUser?.email;
    const profileEmail = (profile as any)?.email;
    const fallbackEmail = profile?.id ? `${profile.id}@sharpsharpone.com` : null;

    const email = authEmail || profileEmail || fallbackEmail;

    if (!email) {
      setError('No email found on your account. Please log out and log in again.');
      return;
    }

    if (!profile?.id) {
      setError('Your profile is still loading. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create a pending deposit record in Firestore
      const depositRef = await addDoc(collection(db, 'transactions'), {
        user_id: profile.id,
        amount: Number(amount),
        type: 'deposit',
        method: 'paystack',
        description: 'Bank transfer via Paystack',
        status: 'pending',
        created_at: serverTimestamp(),
      });

      // 2. Initialize Paystack payment (bank_transfer only)
      const result = await initializePayment({
        email,
        amount: Number(amount),
        userId: profile.id,
      });

      if (!result.success || !result.authorization_url) {
        setError(result.error || 'Failed to initialize payment');
        setLoading(false);
        return;
      }

      // 3. Save the Paystack reference so the callback page can match it
      await addDoc(collection(db, 'paystack_refs'), {
        reference: result.reference,
        transaction_id: depositRef.id,
        user_id: profile.id,
        amount: Number(amount),
        credited: false,
        created_at: serverTimestamp(),
      });

      // 4. Redirect to Paystack checkout
      window.location.href = result.authorization_url;
    } catch (err) {
      console.error('Paystack deposit error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const quickAmounts = [5000, 10000, 20000, 50000, 100000, 200000];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 flex items-center justify-center">
          <ArrowDownToLine size={20} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Deposit Funds</h3>
          <p className="text-xs text-slate-400">Minimum deposit: ₦5,000</p>
        </div>
      </div>

      <div>
        <label className="label-text">Amount (₦)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setAmount(isNaN(val) ? '' : val);
          }}
          placeholder="0.00"
          className="input-field text-lg font-semibold"
          min={MIN_DEPOSIT}
          step="500"
        />
        {error && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {quickAmounts.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(v)}
            className="text-xs py-2 rounded-lg bg-midnight-50/60 border border-obsidian-border text-slate-300 hover:border-emerald-400/40 hover:text-emerald-400 transition-colors"
          >
            ₦{v.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2.5">
        <CreditCard size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          You'll be redirected to Paystack's secure checkout to complete a <span className="text-emerald-400 font-semibold">bank transfer</span>.
          Minimum deposit is <span className="text-emerald-400 font-semibold">₦5,000</span>.
          Your wallet will be credited automatically once the payment is confirmed — no admin approval needed.
        </p>
      </div>

      <div className="flex gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost flex-1 py-3 text-sm"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handlePayWithPaystack}
          disabled={loading || !amount}
          className="btn-emerald flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Processing...
            </>
          ) : (
            <>Pay {amount ? formatNaira(Number(amount)) : ''}</>
          )}
        </button>
      </div>
    </div>
  );
};