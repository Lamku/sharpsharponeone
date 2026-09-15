import { useState, useEffect } from 'react';
import {
  Gift, Plus, Copy, Check, Trash2, Clock, Loader2, Sparkles,
  XCircle, CheckCircle2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { formatNaira, formatTimeAgo } from '@/lib/format';

interface GiftCode {
  id: string;
  code: string;
  amount: number;
  created_by: string;
  created_at: any;
  expires_at: any;
  used: boolean;
  used_by: string | null;
  used_at: any;
}

const EXPIRY_MINUTES = 2;

export function AdminGiftCodes() {
  const [codes, setCodes] = useState<GiftCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState('');
  const [justCreated, setJustCreated] = useState<GiftCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [timeTick, setTimeTick] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTimeTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'giftCodes'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as GiftCode[];
        setCodes(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading gift codes:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let random = '';
    for (let i = 0; i < 6; i++) {
      random += chars[Math.floor(Math.random() * chars.length)];
    }
    return `TV-${random}`;
  };

  const handleCreate = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    setCreating(true);

    try {
      const code = generateCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000);

      const docRef = await addDoc(collection(db, 'giftCodes'), {
        code,
        amount: amountNum,
        created_by: 'admin',
        created_at: serverTimestamp(),
        expires_at: expiresAt,
        used: false,
        used_by: null,
        used_at: null,
      });

      setJustCreated({
        id: docRef.id,
        code,
        amount: amountNum,
        created_by: 'admin',
        created_at: now,
        expires_at: expiresAt,
        used: false,
        used_by: null,
        used_at: null,
      });

      setAmount('');
    } catch (error) {
      console.error('Error creating gift code:', error);
      alert('Failed to create gift code');
    }

    setCreating(false);
  };

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gift code?')) return;
    try {
      await deleteDoc(doc(db, 'giftCodes', id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const getCodeStatus = (gc: GiftCode) => {
    if (gc.used) return 'used';
    const expiresAt = gc.expires_at?.toDate?.() || new Date(0);
    if (new Date(timeTick) > expiresAt) return 'expired';
    return 'active';
  };

  const getTimeRemaining = (gc: GiftCode) => {
    const expiresAt = gc.expires_at?.toDate?.() || new Date(0);
    const remaining = expiresAt.getTime() - timeTick;
    if (remaining <= 0) return 'Expired';
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Generate section */}
      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Gift size={18} className="text-violet-400" />
          </div>
          <div>
            <h2 className="font-bold text-sm mb-1">Generate Gift Code</h2>
            <p className="text-xs text-slate-500">
              Create a code that users can redeem. Codes expire in {EXPIRY_MINUTES} minutes.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">
              ₦
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-xl pl-8 pr-3 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/40"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !amount || parseFloat(amount) <= 0}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center gap-2"
          >
            {creating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <><Plus size={16} /> Generate</>
            )}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3">
          {[500, 1000, 5000, 10000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="text-xs py-2 rounded-lg bg-[#0a0a0f] border border-slate-800/50 text-slate-400 hover:border-violet-500/40 hover:text-violet-400 transition-all"
            >
              ₦{v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Just created */}
      {justCreated && getCodeStatus(justCreated) === 'active' && (
        <div className="bg-gradient-to-br from-emerald/10 to-violet-500/10 border border-emerald/40 rounded-2xl p-5 animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-emerald" />
            <p className="text-xs font-bold text-emerald uppercase tracking-wide">
              New code generated
            </p>
          </div>

          <div className="text-center mb-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">
              Share this code with the user
            </p>
            <p className="text-3xl font-mono font-bold text-white tracking-widest mb-1">
              {justCreated.code}
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Worth <span className="text-gold font-bold">{formatNaira(justCreated.amount)}</span>
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400">
              <Clock size={12} />
              <span className="font-mono font-bold">
                Expires in {getTimeRemaining(justCreated)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleCopy(justCreated.code, justCreated.id)}
              className="flex-1 py-3 rounded-xl bg-emerald text-white text-sm font-semibold hover:bg-emerald/90 transition-all flex items-center justify-center gap-2"
            >
              {copiedId === justCreated.id ? (
                <><Check size={16} /> Copied!</>
              ) : (
                <><Copy size={16} /> Copy Code</>
              )}
            </button>
            <button
              onClick={() => setJustCreated(null)}
              className="px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm font-semibold hover:bg-slate-700/50 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* All codes */}
      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-violet-400" />
            <h2 className="text-sm font-bold">All Gift Codes</h2>
          </div>
          <span className="text-xs text-slate-500">{codes.length} total</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 size={20} className="animate-spin text-violet-400 mx-auto" />
          </div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center">
            <Gift size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No gift codes yet</p>
            <p className="text-slate-600 text-xs mt-1">Generate one above to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/30">
            {codes.map((gc) => {
              const status = getCodeStatus(gc);
              const timeRemaining = getTimeRemaining(gc);
              return (
                <div key={gc.id} className="p-4 flex items-center gap-3 hover:bg-slate-800/10 transition-colors">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      status === 'active'
                        ? 'bg-emerald/15 border border-emerald/30'
                        : status === 'used'
                        ? 'bg-sky-500/15 border border-sky-500/30'
                        : 'bg-red-500/15 border border-red-500/30'
                    }`}
                  >
                    {status === 'active' && <Clock size={16} className="text-emerald" />}
                    {status === 'used' && <CheckCircle2 size={16} className="text-sky-400" />}
                    {status === 'expired' && <XCircle size={16} className="text-red-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-mono font-bold text-white">{gc.code}</span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          status === 'active'
                            ? 'bg-emerald/15 text-emerald'
                            : status === 'used'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {formatNaira(gc.amount)}
                      {status === 'active' && ` · ${timeRemaining} left`}
                      {status === 'used' && gc.used_at && ` · used ${formatTimeAgo(gc.used_at)}`}
                      {status === 'expired' && gc.created_at && ` · created ${formatTimeAgo(gc.created_at)}`}
                    </p>
                  </div>

                  {status === 'active' && (
                    <button
                      onClick={() => handleCopy(gc.code, gc.id)}
                      className="w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:border-violet-500/40 transition-all"
                      title="Copy code"
                    >
                      {copiedId === gc.id ? (
                        <Check size={14} className="text-emerald" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(gc.id)}
                    className="w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}