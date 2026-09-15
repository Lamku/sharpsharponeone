import { useState } from 'react';
import { Gift, Loader2, CheckCircle2, XCircle, AlertCircle, Sparkles, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { formatNaira } from '@/lib/format';

export function RedeemGiftScreen() {
  const { profile, refreshProfile } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { type: 'success'; amount: number }
    | { type: 'expired' }
    | { type: 'used' }
    | { type: 'invalid' }
    | { type: 'error'; message: string }
    | null
  >(null);

  const handleRedeem = async () => {
    if (!profile) return;
    if (!code.trim()) return;

    setLoading(true);
    setResult(null);

    const cleanCode = code.trim().toUpperCase();

    try {
      const q = query(collection(db, 'giftCodes'), where('code', '==', cleanCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        setResult({ type: 'invalid' });
        setLoading(false);
        return;
      }

      const codeDoc = snap.docs[0];
      const codeData = codeDoc.data();

      if (codeData.used) {
        setResult({ type: 'used' });
        setLoading(false);
        return;
      }

      const expiresAt = codeData.expires_at?.toDate?.() || new Date(0);
      const now = new Date();

      if (now > expiresAt) {
        setResult({ type: 'expired' });
        setLoading(false);
        return;
      }

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.id);
        const codeRef = doc(db, 'giftCodes', codeDoc.id);

        const userSnap = await transaction.get(userRef);
        const codeSnap = await transaction.get(codeRef);

        if (!userSnap.exists()) throw new Error('User not found');
        if (!codeSnap.exists()) throw new Error('Code not found');

        const userData = userSnap.data();
        const freshCodeData = codeSnap.data();

        if (freshCodeData.used) throw new Error('Already used');
        const freshExpiry = freshCodeData.expires_at?.toDate?.() || new Date(0);
        if (new Date() > freshExpiry) throw new Error('Expired');

        const amount = freshCodeData.amount || 0;

        transaction.update(userRef, {
          wallet_balance: (userData.wallet_balance || 0) + amount,
          portfolio_value: (userData.portfolio_value || 0) + amount,
        });

        transaction.update(codeRef, {
          used: true,
          used_by: profile.id,
          used_at: serverTimestamp(),
        });

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          user_id: profile.id,
          amount: amount,
          type: 'gift',
          description: `Redeemed gift code: ${cleanCode}`,
          status: 'approved',
          created_at: serverTimestamp(),
        });
      });

      await refreshProfile();
      setResult({ type: 'success', amount: codeData.amount || 0 });
      setCode('');
    } catch (error: any) {
      console.error('Redeem error:', error);
      const msg = error.message || 'Failed to redeem code';
      if (msg === 'Already used') setResult({ type: 'used' });
      else if (msg === 'Expired') setResult({ type: 'expired' });
      else setResult({ type: 'error', message: 'Something went wrong. Try again.' });
    }

    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 mt-1">
        <div>
          <h2 className="text-lg font-bold text-white">Redeem Gift</h2>
          <p className="text-xs text-slate-400">Enter a gift code to claim your reward</p>
        </div>
      </div>

      {/* ⭐ Telegram Support Callout */}
      <div className="glass-card p-5 mb-4 relative overflow-hidden animate-slide-up">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-sky-500/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
              <Send size={20} className="text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white mb-0.5">
                Get Gift Codes on Telegram
              </h3>
              <p className="text-[11px] text-sky-300 font-medium">
                Tap the blue Telegram button to join
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Gift codes are released <span className="text-gold font-semibold">every day</span> in our
              official Telegram group. Join the community, be the first to grab a code, and test
              your luck for instant wallet rewards.
            </p>

            <ul className="space-y-2 text-[11px] text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                <span>Daily gift codes posted by our team</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                <span>First come, first served — codes are limited</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                <span>Exclusive drops, announcements &amp; support</span>
              </li>
            </ul>

            <a
              href="https://t.me/+BHDMWqhc2uJjNDM0"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 mt-1"
            >
              <Send size={15} /> Join Telegram Group
            </a>

            <p className="text-[10px] text-slate-500 text-center">
              Or tap the floating Telegram button on any screen.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-5 mb-4 relative overflow-hidden animate-slide-up">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gold/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-emerald/10 blur-2xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold/30 to-emerald/20 border border-gold/40 flex items-center justify-center">
              <Gift size={24} className="text-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Have a code?</p>
              <p className="text-[11px] text-slate-400">
                Codes expire 2 minutes after being generated
              </p>
            </div>
          </div>

          <label className="label-text">Enter Gift Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="TV-XXXXXX"
            maxLength={20}
            className="input-field text-center text-lg font-bold tracking-widest uppercase"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRedeem();
            }}
          />

          <button
            onClick={handleRedeem}
            disabled={loading || !code.trim()}
            className="btn-gold w-full mt-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Redeeming...</>
            ) : (
              <><Sparkles size={16} /> Redeem Gift</>
            )}
          </button>
        </div>
      </div>

      {result?.type === 'success' && (
        <div className="glass-card p-5 text-center animate-slide-up">
          <div className="w-14 h-14 rounded-full bg-emerald/15 border border-emerald/40 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={28} className="text-emerald" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Gift Redeemed! 🎉</h3>
          <p className="text-sm text-slate-400 mb-3">
            You've received <span className="text-gold font-bold">{formatNaira(result.amount)}</span>
          </p>
          <p className="text-xs text-emerald">Amount credited to your wallet instantly</p>
        </div>
      )}

      {result?.type === 'expired' && (
        <div className="glass-card p-5 text-center animate-slide-up border border-red-500/30">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Code Expired</h3>
          <p className="text-sm text-slate-400">
            This gift code has expired. Gift codes expire{' '}
            <span className="text-red-400 font-semibold">2 minutes</span> after being generated.
          </p>
        </div>
      )}

      {result?.type === 'used' && (
        <div className="glass-card p-5 text-center animate-slide-up border border-gold/30">
          <div className="w-14 h-14 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center mx-auto mb-3">
            <XCircle size={28} className="text-gold" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Code Already Used</h3>
          <p className="text-sm text-slate-400">This gift code has already been redeemed.</p>
        </div>
      )}

      {result?.type === 'invalid' && (
        <div className="glass-card p-5 text-center animate-slide-up border border-red-500/30">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto mb-3">
            <XCircle size={28} className="text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Invalid Code</h3>
          <p className="text-sm text-slate-400">We couldn't find that gift code. Please check and try again.</p>
        </div>
      )}

      {result?.type === 'error' && (
        <div className="glass-card p-5 text-center animate-slide-up border border-red-500/30">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Something went wrong</h3>
          <p className="text-sm text-slate-400">{result.message}</p>
        </div>
      )}

      <div className="glass-card p-4 mt-4 animate-slide-up">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-3">How it works</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-sky-400">1</span>
            </div>
            <p className="text-xs text-slate-400">
              Join our <span className="text-sky-300 font-semibold">Telegram group</span> to receive gift codes posted daily
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-gold">2</span>
            </div>
            <p className="text-xs text-slate-400">
              Copy a code and enter it above — codes expire <strong>2 minutes</strong> after being posted
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald/15 border border-emerald/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-emerald">3</span>
            </div>
            <p className="text-xs text-slate-400">
              Instantly credited to your wallet — start investing right away
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}