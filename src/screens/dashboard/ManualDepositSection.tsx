import React, { useState } from 'react';
import { Building2, Copy, CheckCircle2, AlertCircle, Loader2, ArrowRight, Clock, Shield, Sparkles } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { PlatformSettings } from '@/lib/settings';
import { notifyDeposit } from '@/lib/telegram';

interface ManualDepositSectionProps {
  settings: PlatformSettings;
  onClose?: () => void;
}

const MIN_DEPOSIT = 2700;

export const ManualDepositSection: React.FC<ManualDepositSectionProps> = ({ settings, onClose }) => {
  const { profile } = useAuth();

  // Step 1 fields
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  // Step 2 fields
  const [reference, setReference] = useState('');

  // UI state
  const [step, setStep] = useState<'amount' | 'checkout'>('amount');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showProgressPopup, setShowProgressPopup] = useState(false);

  const amountNum = typeof amount === 'number' ? amount : 0;
  const canProceed = amountNum >= MIN_DEPOSIT;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Step 1 → Step 2
  const handleNext = () => {
    setError('');
    if (!amountNum || amountNum < MIN_DEPOSIT) {
      setError(`Minimum deposit is ${formatNaira(MIN_DEPOSIT)}`);
      return;
    }
    setStep('checkout');
  };

  // Step 2 → Submit
  const handleSubmit = async () => {
    if (!profile?.id) return;
    if (!reference.trim()) {
      setError('Please enter the transfer reference / narration');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await addDoc(collection(db, 'transactions'), {
        user_id: profile.id,
        amount: amountNum,
        type: 'deposit',
        method: 'bank_transfer',
        description: description.trim()
          ? `Manual bank transfer — ${description.trim()} (Ref: ${reference.trim()})`
          : `Manual bank transfer — Ref: ${reference.trim()}`,
        user_note: description.trim() || null,
        reference: reference.trim(),
        status: 'pending',
        credited: false,
        created_at: serverTimestamp(),
      });

      try {
        await notifyDeposit({
          userName: profile.full_name || 'Unknown',
          userPhone: profile.phone || 'N/A',
          amount: amountNum,
          reference: reference.trim(),
          method: 'manual',
        });
      } catch (tErr) {
        console.warn('Telegram notify failed:', tErr);
      }

      // ⭐ Show popup FIRST — don't call onClose() yet,
      //    otherwise the parent modal unmounts this component
      //    and the popup never appears.
      setShowProgressPopup(true);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Could not submit. Try again.');
      setLoading(false);
    }
  };

  // ⭐ "Deposit in progress" popup — closing it also closes the parent modal
  if (showProgressPopup) {
    return (
      <ProgressPopup
        amount={amountNum}
        onClose={() => {
          setShowProgressPopup(false);
          if (onClose) onClose();
        }}
      />
    );
  }

  // ==================================================
  // STEP 1 — Amount + Description
  // ==================================================
  if (step === 'amount') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00A04A]/20 to-[#007A33]/10 border border-[#00A04A]/30 flex items-center justify-center">
            <Sparkles size={20} className="text-[#007A33]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0A2A1A]">Fund your wallet</h3>
            <p className="text-xs text-[#4A5A50]">Minimum deposit {formatNaira(MIN_DEPOSIT)}</p>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="label-text">Enter Amount (₦)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setAmount(isNaN(val) ? '' : val);
            }}
            placeholder="0.00"
            className="input-field text-2xl font-extrabold text-center tracking-tight"
            min={MIN_DEPOSIT}
            step="100"
            autoFocus
          />

          {/* Quick pick chips */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[2700, 5000, 10000, 50000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={`text-xs py-2 rounded-lg border font-semibold transition-all ${
                  amountNum === v
                    ? 'bg-[#007A33] text-white border-[#007A33]'
                    : 'bg-[#F5F7F5] border-[#E8EDE8] text-[#4A5A50] hover:border-[#007A33]/40'
                }`}
              >
                ₦{v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Description (optional) */}
        <div>
          <label className="label-text">Deposit Description <span className="text-[#8A9A90] normal-case">(optional)</span></label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Weekly top-up, savings etc."
            className="input-field text-sm"
            maxLength={80}
          />
        </div>

        {/* Hint */}
        <div className="px-3 py-2.5 rounded-xl bg-[#007A33]/8 border border-[#007A33]/20 flex items-start gap-2">
          <Shield size={14} className="text-[#007A33] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#4A5A50] leading-relaxed">
            Next step shows you the <span className="text-[#007A33] font-semibold">bank account</span> to send your transfer to.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {onClose && (
            <button onClick={onClose} className="btn-ghost flex-1 py-3 text-sm">
              Cancel
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="btn-emerald flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Next <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ==================================================
  // STEP 2 — Checkout (Bank details)
  // ==================================================
  return (
    <div className="space-y-5">
      {/* Header with summary */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setStep('amount'); setError(''); }}
          className="w-9 h-9 rounded-xl bg-[#F5F7F5] border border-[#E8EDE8] flex items-center justify-center text-[#007A33] hover:bg-[#E8EDE8] transition-colors"
          aria-label="Back"
        >
          <ArrowRight size={18} className="rotate-180" />
        </button>
        <div>
          <h3 className="text-base font-bold text-[#0A2A1A]">Complete your transfer</h3>
          <p className="text-xs text-[#4A5A50]">Send the exact amount below</p>
        </div>
      </div>

      {/* Amount summary card */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-[#007A33] to-[#005A26] shadow-md relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-white/80 font-semibold mb-1">You're sending</p>
          <p className="text-3xl font-extrabold text-white tracking-tight">{formatNaira(amountNum)}</p>
          {description.trim() && (
            <p className="text-[11px] text-white/80 mt-1.5 italic truncate">"{description.trim()}"</p>
          )}
        </div>
      </div>

      {/* Bank details card */}
      <div className="rounded-2xl p-4 bg-[#F5F7F5] border border-[#E8EDE8] space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-white border border-[#E8EDE8] flex items-center justify-center">
            <Building2 size={16} className="text-[#007A33]" />
          </div>
          <p className="text-[10px] font-bold text-[#4A5A50] uppercase tracking-widest">Send money to</p>
        </div>

        <div className="space-y-2.5">
          <DetailRow label="Bank" value={settings.manualBankName || '—'} />
          <DetailRow
            label="Account Number"
            value={settings.manualBankAccountNumber || '—'}
            mono
            copyable
            onCopy={() => handleCopy(settings.manualBankAccountNumber)}
            copied={copied}
          />
          <DetailRow label="Account Name" value={settings.manualBankAccountName || '—'} />
        </div>
      </div>

      {/* Reference input */}
      <div>
        <label className="label-text">Transfer Reference / Narration</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. TRANSFER-ABC123"
          className="input-field text-sm"
        />
        <p className="text-[11px] text-amber-500/90 mt-1 flex items-center gap-1">
          <AlertCircle size={12} />
          Enter the exact reference from your bank app so we can match your payment
        </p>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-start gap-2">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Info banner */}
      <div className="px-3 py-2.5 rounded-xl bg-[#007A33]/10 border border-[#007A33]/30 text-[11px] text-[#007A33] flex items-start gap-2">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        <span>Your wallet will be credited after our team confirms your transfer. This usually takes a few minutes.</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => { setStep('amount'); setError(''); }}
          className="btn-ghost flex-1 py-3 text-sm"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !reference.trim()}
          className="btn-emerald flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting...</>
          ) : (
            <><CheckCircle2 size={16} /> I have made the payment</>
          )}
        </button>
      </div>
    </div>
  );
};

// ==================================================
// ⭐ "Deposit in Progress" POPUP
// ==================================================
function ProgressPopup({ amount, onClose }: { amount: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 rounded-2xl animate-slide-up relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Green decorative blobs */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#007A33]/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-[#00A04A]/10 blur-2xl" />

        <div className="relative text-center">
          {/* Pulsing icon */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-[#007A33]/15 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#007A33] to-[#005A26] flex items-center justify-center shadow-lg">
              <Clock size={36} className="text-white animate-pulse" />
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-[#0A2A1A] mb-1.5">
            Deposit in Progress
          </h2>

          <p className="text-sm text-[#4A5A50] mb-4">
            We've received your transfer notification for
          </p>

          <div className="inline-block px-5 py-2 rounded-full bg-[#007A33]/10 border border-[#007A33]/30 mb-5">
            <span className="text-lg font-extrabold text-[#007A33]">{formatNaira(amount)}</span>
          </div>

          <div className="rounded-xl bg-[#F5F7F5] border border-[#E8EDE8] p-3.5 mb-5 text-left space-y-2">
            <div className="flex items-start gap-2">
              <Shield size={14} className="text-[#007A33] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#4A5A50] leading-relaxed">
                Our team is <span className="text-[#007A33] font-semibold">verifying your payment</span> now.
                You'll be notified once it's confirmed — usually within a few minutes.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-[#007A33] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#4A5A50] leading-relaxed">
                No further action is needed on your side. Sit back and relax.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-emerald w-full py-3 text-sm font-bold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================================================
// Helper row
// ==================================================
function DetailRow({ label, value, mono, copyable, onCopy, copied }: {
  label: string; value: string; mono?: boolean; copyable?: boolean; onCopy?: () => void; copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-[#4A5A50]">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm font-semibold text-[#0A2A1A] truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="p-1.5 rounded-lg bg-white border border-[#E8EDE8] text-[#4A5A50] hover:text-[#007A33] hover:border-[#007A33]/30 transition-colors flex-shrink-0"
            title="Copy"
          >
            {copied ? <CheckCircle2 size={13} className="text-[#00A04A]" /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}