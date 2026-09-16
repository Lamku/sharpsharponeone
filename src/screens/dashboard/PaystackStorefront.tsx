import React, { useState } from 'react';
import { CreditCard, ExternalLink, Shield, Loader2, ArrowRight } from 'lucide-react';
import type { PlatformSettings } from '@/lib/settings';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface PaystackStorefrontProps {
  settings: PlatformSettings;
  onClose?: () => void;
}

export const PaystackStorefront: React.FC<PaystackStorefrontProps> = ({
  settings,
  onClose,
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const storefrontUrl =
    settings.paystackStorefrontUrl || 'https://paystack.shop/pay/sharpsharpone';

  const handleGoToStore = async () => {
    if (!profile?.id) {
      alert('You must be logged in to deposit.');
      return;
    }

    setLoading(true);

    try {
      // ⭐ Create a "deposit intent" BEFORE redirecting to Paystack.
      // When the user comes back, DepositCallback matches the most recent
      // unused intent to the incoming Paystack reference — this is how we
      // know which user the payment belongs to (since the storefront
      // doesn't pass metadata to Paystack).
      await addDoc(collection(db, 'deposit_intents'), {
        user_id: profile.id,
        user_name: profile.full_name || 'Unknown',
        user_phone: profile.phone || 'N/A',
        user_email: (profile as any).email || `${profile.id}@sharpsharpone.com`,
        created_at: serverTimestamp(),
        used: false,
      });

      // Save intent locally as a fallback (in case the callback runs on
      // the same browser session)
      try {
        sessionStorage.setItem('deposit_intent_user', profile.id);
        sessionStorage.setItem('deposit_intent_time', String(Date.now()));
      } catch {}

      // Redirect to the Paystack storefront
      window.location.href = storefrontUrl;
    } catch (err) {
      console.error('Failed to create deposit intent:', err);
      setLoading(false);
      alert('Could not start deposit. Please try again.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 flex items-center justify-center">
          <CreditCard size={20} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Pay with Paystack</h3>
          <p className="text-xs text-slate-400">Instant wallet funding</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-emerald-300 mb-1">Secure Payment</p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              You'll be redirected to our official Paystack storefront. Complete your payment
              securely and your wallet will be credited automatically.
            </p>
          </div>
        </div>

        <div className="border-t border-emerald-500/20 pt-3">
          <ul className="text-[11px] text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <span>Minimum deposit: <span className="text-white font-semibold">₦5,000</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <span>Card, bank transfer, USSD all supported</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <span>Wallet credited automatically after payment</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
        <ExternalLink size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-200 leading-relaxed">
          <b>Important:</b> After paying, please return to Sharpsharpone. If your wallet doesn't
          credit within 60 seconds, keep your Paystack receipt and contact support.
        </p>
      </div>

      <div className="flex gap-3">
        {onClose && (
          <button
            onClick={onClose}
            className="btn-ghost flex-1 py-3 text-sm"
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleGoToStore}
          disabled={loading}
          className="btn-emerald flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Redirecting...
            </>
          ) : (
            <>
              Proceed to Payment <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};