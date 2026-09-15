import React, { useState } from 'react';
import { Building2, Copy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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

export const ManualDepositSection: React.FC<ManualDepositSectionProps> = ({
  settings,
  onClose,
}) => {
  const { profile } = useAuth();
  const [amount, setAmount] = useState<number | ''>('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = async () => {
    if (!amount || amount < 5000) {
      setError('Minimum deposit is ₦5,000');
      return;
    }
    if (!reference.trim()) {
      setError('Please enter the transfer reference / narration');
      return;
    }
    if (!profile?.id) return;

    setLoading(true);
    setError('');
    try {
      // ⚠️ IMPORTANT: This creates a PENDING deposit.
      // Wallet is NOT credited here — admin must approve it.
            await addDoc(collection(db, 'transactions'), {
        user_id: profile.id,
        amount: Number(amount),
        type: 'deposit',
        method: 'bank_transfer',
        description: `Manual bank transfer — Ref: ${reference.trim()}`,
        reference: reference.trim(),
        status: 'pending',
        credited: false,
        created_at: serverTimestamp(),
      });

      // ⭐ Telegram — notify admin of manual deposit submission
      try {
        await notifyDeposit({
          userName: profile.full_name || 'Unknown',
          userPhone: profile.phone || 'N/A',
          amount: Number(amount),
          reference: reference.trim(),
          method: 'manual',
        });
      } catch (tErr) {
        console.warn('Telegram notify failed:', tErr);
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('Could not submit. Try again.');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald/15 border border-emerald/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Deposit Submitted</h3>
        <p className="text-xs text-slate-400 mb-5">
          Your transfer of {formatNaira(Number(amount))} is awaiting admin approval. You'll be
          notified once credited.
        </p>
        <button onClick={onClose} className="btn-emerald w-full py-3 text-sm">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 flex items-center justify-center">
          <Building2 size={20} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Bank Transfer Deposit</h3>
          <p className="text-xs text-slate-400">Transfer to the account below</p>
        </div>
      </div>

      {/* Bank details */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 space-y-3">
        <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wide">
          Send money to
        </p>

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

      <div>
        <label className="label-text">Amount Sent (₦)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setAmount(isNaN(val) ? '' : val);
          }}
          placeholder="0.00"
          className="input-field text-lg font-semibold"
          min={5000}
          step="500"
        />
      </div>

      <div>
        <label className="label-text">Transfer Reference / Narration</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. TRANSFER-ABC123"
          className="input-field text-sm"
        />
        <p className="text-[11px] text-amber-400/70 mt-1 flex items-center gap-1">
          <AlertCircle size={12} />
          Enter the reference/narration from your bank app so we can match it
        </p>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Explicit warning so user understands nothing is instant */}
      <div className="px-3 py-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-300 flex items-start gap-2">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          Your wallet will be credited after our team confirms your transfer. This usually
          takes a few minutes.
        </span>
      </div>

      <div className="flex gap-3">
        {onClose && (
          <button onClick={onClose} className="btn-ghost flex-1 py-3 text-sm">
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !amount || !reference}
          className="btn-emerald flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Submitting...
            </>
          ) : (
            'I have made the transfer'
          )}
        </button>
      </div>
    </div>
  );
};

function DetailRow({
  label,
  value,
  mono,
  copyable,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm font-semibold text-white truncate ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded text-slate-400 hover:text-emerald transition-colors flex-shrink-0"
            title="Copy"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald" /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}