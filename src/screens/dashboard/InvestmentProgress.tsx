import React, { useEffect, useState } from 'react';
import { TrendingUp, Clock, CheckCircle2, Loader2, Calendar, Zap, Award } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatNaira } from '@/lib/format';

interface Investment {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name?: string;
  amount: number;
  daily_yield: number;
  total_return: number;
  duration_days: number;
  active: boolean;
  start_date: any;
  end_date: any;
  last_yield_date: any;
  accrued_yield: number;
  created_at: any;
}

export const InvestmentProgress: React.FC = () => {
  const { profile } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    const q = query(collection(db, 'investments'), where('user_id', '==', profile.id));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Investment[];
      data.sort((a, b) => {
        const at = a.created_at?.toDate?.()?.getTime?.() || 0;
        const bt = b.created_at?.toDate?.()?.getTime?.() || 0;
        return bt - at;
      });
      setInvestments(data);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[#007A33]" />
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-[#007A33]/10 border border-[#007A33]/30 flex items-center justify-center mx-auto mb-3">
          <TrendingUp size={26} className="text-[#007A33]" />
        </div>
        <p className="text-sm font-semibold text-[#0A2A1A] mb-1">No investments yet</p>
        <p className="text-xs text-[#4A5A50]">Purchase a plan to start earning daily returns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {investments.map((inv) => (
        <InvestmentCard key={inv.id} investment={inv} now={now} />
      ))}
    </div>
  );
};

function InvestmentCard({ investment, now }: { investment: Investment; now: number }) {
  const startDate = investment.start_date?.toDate?.() || investment.created_at?.toDate?.() || new Date();
  const endDate = investment.end_date?.toDate?.() || new Date(startDate.getTime() + (investment.duration_days || 0) * 24 * 60 * 60 * 1000);
  const lastYieldDate = investment.last_yield_date?.toDate?.() || startDate;

  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = Math.min(now - startDate.getTime(), totalMs);
  const progressPct = totalMs > 0 ? Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100)) : 0;

  const daysElapsed = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, (investment.duration_days || 0) - daysElapsed);

  const nextYieldMs = lastYieldDate.getTime() + 24 * 60 * 60 * 1000;
  const msToNextYield = Math.max(0, nextYieldMs - now);
  const hours = Math.floor(msToNextYield / (1000 * 60 * 60));
  const minutes = Math.floor((msToNextYield % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((msToNextYield % (1000 * 60)) / 1000);

  const totalEarned = investment.accrued_yield || 0;
  const totalExpected = investment.total_return || investment.daily_yield * investment.duration_days;

  return (
    <div className="bg-[#F5F7F5] rounded-2xl border border-[#E8EDE8] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-[#0A2A1A] truncate">{investment.plan_name || 'Investment Plan'}</span>
            {investment.active ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#00A04A]/15 text-[#00A04A] border border-[#00A04A]/30">
                <Zap size={9} /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#007A33]/15 text-[#007A33] border border-[#007A33]/30">
                <Award size={9} /> Completed
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#4A5A50]">
            Invested {formatNaira(investment.amount)} • {investment.duration_days} days
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-bold text-[#007A33]">{formatNaira(investment.daily_yield)}</p>
          <p className="text-[10px] text-[#8A9A90]">per day</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-[#4A5A50]">Progress</span>
          <span className="text-[#0A2A1A] font-mono tabular-nums">
            {progressPct.toFixed(1)}% • Day {daysElapsed}/{investment.duration_days}
          </span>
        </div>
        <div className="h-2.5 bg-[#E8EDE8] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#007A33] via-[#00A04A] to-[#00A04A] rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatBox icon={<TrendingUp size={12} className="text-[#00A04A]" />} label="Earned so far" value={formatNaira(totalEarned)} accent="emerald" />
        <StatBox icon={<Calendar size={12} className="text-[#007A33]" />} label="Expected total" value={formatNaira(totalExpected)} accent="sky" />
      </div>

      {investment.active ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#E8EDE8]">
          <div className="flex items-center gap-2 min-w-0">
            <Clock size={13} className="text-[#007A33] flex-shrink-0" />
            <span className="text-[11px] text-[#4A5A50] truncate">Next payout in</span>
          </div>
          <span className="text-sm font-bold text-[#007A33] font-mono tabular-nums flex-shrink-0">
            {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#00A04A]/10 border border-[#00A04A]/30">
          <CheckCircle2 size={14} className="text-[#00A04A] flex-shrink-0" />
          <span className="text-[11px] text-[#00A04A] font-semibold">Completed • Full return paid</span>
        </div>
      )}

      {investment.active && (
        <p className="text-[10px] text-[#8A9A90] text-center mt-2">
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
        </p>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent: 'emerald' | 'sky';
}) {
  const bg = accent === 'emerald' ? 'bg-[#00A04A]/10 border-[#00A04A]/20' : 'bg-[#007A33]/10 border-[#007A33]/20';
  const text = accent === 'emerald' ? 'text-[#00A04A]' : 'text-[#007A33]';
  return (
    <div className={`p-2.5 rounded-xl ${bg} border`}>
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] text-[#4A5A50]">{label}</span>
      </div>
      <p className={`text-sm font-bold ${text}`}>{value}</p>
    </div>
  );
}