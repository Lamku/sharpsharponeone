import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatNaira, formatTimeAgo } from '@/lib/format';
import { ArrowDownToLine, ArrowUpFromLine, CalendarCheck, Gift, Sparkles, Users, TrendingUp, Coins, AlertCircle, Loader2 } from 'lucide-react';

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: any;
}

const typeMeta: Record<string, { icon: any; color: string; bg: string; sign: string }> = {
  deposit:      { icon: ArrowDownToLine, color: 'text-[#00A04A]',   bg: 'bg-[#00A04A]/10 border-[#00A04A]/30',   sign: '+' },
  withdrawal:   { icon: ArrowUpFromLine, color: 'text-[#007A33]',   bg: 'bg-[#007A33]/10 border-[#007A33]/30',   sign: '-' },
  check_in:     { icon: CalendarCheck,   color: 'text-[#00A04A]',   bg: 'bg-[#00A04A]/10 border-[#00A04A]/30',   sign: '+' },
  welcome_bonus:{ icon: Sparkles,        color: 'text-[#007A33]',   bg: 'bg-[#007A33]/10 border-[#007A33]/30',   sign: '+' },
  investment:   { icon: TrendingUp,      color: 'text-[#007A33]',   bg: 'bg-[#007A33]/10 border-[#007A33]/30',   sign: '-' },
  referral:     { icon: Users,           color: 'text-[#00A04A]',   bg: 'bg-[#00A04A]/10 border-[#00A04A]/30',   sign: '+' },
  yield:        { icon: Coins,           color: 'text-[#00A04A]',   bg: 'bg-[#00A04A]/10 border-[#00A04A]/30',   sign: '+' },
  gift:         { icon: Gift,            color: 'text-[#007A33]',   bg: 'bg-[#007A33]/10 border-[#007A33]/30',   sign: '+' },
};

const defaultMeta = {
  icon: Coins,
  color: 'text-[#4A5A50]',
  bg: 'bg-[#F5F7F5] border-[#E8EDE8]',
  sign: '+',
};

export function WalletScreen() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  useEffect(() => {
    if (!profile) { setLoading(false); return; }

    const q = query(collection(db, 'transactions'), where('user_id', '==', profile.id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
        const sorted = data.sort((a, b) => {
          const aTime = a.created_at?.toDate?.()?.getTime() || 0;
          const bTime = b.created_at?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });
        setTransactions(sorted.slice(0, 50));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error loading transactions:', err);
        setError('Failed to load transactions');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[#007A33] mb-3" />
        <p className="text-sm text-[#4A5A50]">Loading wallet...</p>
      </div>
    );
  }

  const filtered = transactions.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'in') return ['deposit', 'check_in', 'welcome_bonus', 'referral', 'yield', 'gift'].includes(t.type);
    return ['withdrawal', 'investment'].includes(t.type);
  });

  const totalIn = transactions
    .filter((t) => ['deposit', 'check_in', 'welcome_bonus', 'referral', 'yield', 'gift'].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOut = transactions
    .filter((t) => ['withdrawal', 'investment'].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div>
      <h2 className="text-lg font-bold text-[#0A2A1A] mb-3 mt-1">My Wallet</h2>

      <div className="glass-card p-5 mb-4 relative overflow-hidden animate-slide-up">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#007A33]/8 blur-2xl" />
        <div className="relative">
          <p className="text-xs text-[#4A5A50] uppercase tracking-wider font-semibold mb-1">Current Balance</p>
          <p className="text-3xl font-extrabold text-[#007A33] mb-4">{formatNaira(profile.wallet_balance || 0)}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F5F7F5] rounded-xl p-3 border border-[#E8EDE8]">
              <div className="flex items-center gap-1 text-[#00A04A] mb-1">
                <ArrowDownToLine size={13} />
                <span className="text-[11px] font-medium text-[#4A5A50]">Total In</span>
              </div>
              <span className="text-sm font-bold text-[#0A2A1A]">{formatNaira(totalIn)}</span>
            </div>
            <div className="bg-[#F5F7F5] rounded-xl p-3 border border-[#E8EDE8]">
              <div className="flex items-center gap-1 text-[#007A33] mb-1">
                <ArrowUpFromLine size={13} />
                <span className="text-[11px] font-medium text-[#4A5A50]">Total Out</span>
              </div>
              <span className="text-sm font-bold text-[#0A2A1A]">{formatNaira(totalOut)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {([
          { key: 'all', label: 'All' },
          { key: 'in', label: 'Income' },
          { key: 'out', label: 'Spent' },
        ] as const).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              filter === f.key
                ? 'bg-[#007A33]/15 text-[#007A33] border border-[#007A33]/30'
                : 'bg-[#F5F7F5] text-[#4A5A50] border border-[#E8EDE8] hover:text-[#0A2A1A]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="glass-card p-4 mb-3 border border-red-500/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8EDE8]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-[#E8EDE8] rounded" />
                  <div className="h-2 w-16 bg-[#E8EDE8] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-[#4A5A50]">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t, i) => {
            const meta = typeMeta[t.type] || defaultMeta;
            const Icon = meta.icon;
            return (
              <div key={t.id} className="glass-card p-3.5 flex items-center gap-3 animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                  <Icon size={18} className={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0A2A1A] truncate">{t.description || 'Transaction'}</p>
                  <p className="text-[11px] text-[#8A9A90] capitalize">
                    {(t.type || 'unknown').replace('_', ' ')} · {formatTimeAgo(t.created_at)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${meta.color} flex-shrink-0`}>
                  {meta.sign}{formatNaira(Number(t.amount || 0))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}