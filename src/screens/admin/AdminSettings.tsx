import React, { useEffect, useState } from 'react';
import { Settings, Save, CreditCard, Building2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  PlatformSettings,
  getPlatformSettings,
  updatePlatformSettings,
} from '@/lib/settings';

export function AdminSettings() {
  const { admin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getPlatformSettings();
      setSettings(s);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updatePlatformSettings(settings, admin?.phone);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings');
    }
    setSaving(false);
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-red-500" size={32} />
      </div>
    );
  }

  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/10 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
            <Settings size={20} className="text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold">Platform Settings</h2>
            <p className="text-xs text-slate-500">
              Switch deposit and withdrawal modes, and configure manual bank details shown to users.
            </p>
          </div>
        </div>
      </div>

      {/* ============ DEPOSIT MODE ============ */}
      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={16} className="text-emerald-400" />
          <h3 className="text-sm font-bold">Deposit Mode</h3>
        </div>

        <ToggleRow
          label="Paystack Deposits"
          description="Users pay via Paystack checkout (bank transfer). Wallet credits automatically on webhook."
          checked={settings.paystackEnabled}
          onChange={(v) => set('paystackEnabled', v)}
        />

        <ToggleRow
          label="Manual Bank Transfer Deposits"
          description="Users see your bank details and submit proof. Admin approves manually."
          checked={settings.manualDepositEnabled}
          onChange={(v) => set('manualDepositEnabled', v)}
        />

        {settings.manualDepositEnabled && (
          <div className="mt-4 p-4 rounded-xl bg-[#0a0a0f] border border-slate-800/50 space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Bank details shown to users
            </p>

            <Field label="Bank Name">
              <input
                type="text"
                value={settings.manualBankName}
                onChange={(e) => set('manualBankName', e.target.value)}
                placeholder="e.g. Access Bank"
                className="w-full bg-[#0f0f16] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/40"
              />
            </Field>

            <Field label="Account Number">
              <input
                type="text"
                value={settings.manualBankAccountNumber}
                onChange={(e) =>
                  set('manualBankAccountNumber', e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                placeholder="0123456789"
                maxLength={10}
                className="w-full bg-[#0f0f16] border border-slate-800/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/40"
              />
            </Field>

            <Field label="Account Name">
              <input
                type="text"
                value={settings.manualBankAccountName}
                onChange={(e) => set('manualBankAccountName', e.target.value)}
                placeholder="e.g. Sharpsharpone Ltd"
                className="w-full bg-[#0f0f16] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/40"
              />
            </Field>

            <div className="pt-2 flex items-start gap-2 text-[11px] text-amber-400/80">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                Make sure the details are correct. These are shown on the user's deposit screen.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ============ WITHDRAWAL MODE ============ */}
      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={16} className="text-red-400" />
          <h3 className="text-sm font-bold">Withdrawal Mode</h3>
        </div>

        <ToggleRow
          label="Paystack Withdrawals (Transfers API)"
          description="Auto-sends money to user's bank via Paystack. Only works for Registered Businesses with CAC."
          checked={settings.paystackWithdrawalEnabled}
          onChange={(v) => set('paystackWithdrawalEnabled', v)}
          warning={!settings.paystackWithdrawalEnabled ? 'Disabled until CAC upgrade' : undefined}
        />

        <ToggleRow
          label="Manual Withdrawals"
          description="Admin approves, sends money from own bank app, then clicks 'Mark as Paid' to update records."
          checked={settings.manualWithdrawalEnabled}
          onChange={(v) => set('manualWithdrawalEnabled', v)}
        />

        {settings.paystackWithdrawalEnabled && settings.manualWithdrawalEnabled && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-400 flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Both withdrawal modes are ON. Paystack will be attempted first. If it fails, you can
              fall back to manual.
            </span>
          </div>
        )}

        {settings.paystackWithdrawalEnabled && !settings.manualWithdrawalEnabled && (
          <div className="p-3 rounded-xl bg-emerald/10 border border-emerald/30 text-[11px] text-emerald flex items-start gap-2">
            <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Paystack Withdrawals are LIVE. All admin approvals will auto-send money via Paystack.
            </span>
          </div>
        )}

        {!settings.paystackWithdrawalEnabled && settings.manualWithdrawalEnabled && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-400 flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Manual mode is live. Admin approves, sends money from own bank app, then clicks
              "Mark as Paid".
            </span>
          </div>
        )}
      </div>

      {/* SAVE BAR */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xl">
          <p className="text-xs text-slate-400">
            {saved ? (
              <span className="text-emerald flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Settings saved
              </span>
            ) : (
              'Changes apply immediately to the user dashboard.'
            )}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  warning,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        {warning && (
          <p className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
            <AlertCircle size={10} /> {warning}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ${
          checked ? 'bg-emerald' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}