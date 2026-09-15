import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { Users, Copy, Check, Share2, Gift, TrendingUp, UserPlus, Zap, Clock } from 'lucide-react';
import { formatNaira } from '@/lib/format';

interface TeamMember {
  id: string;
  full_name: string;
  phone: string;
  wallet_balance: number;
  portfolio_value: number;
  referral_commission_paid?: boolean;
  created_at: any;
}

export function TeamScreen() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Real-time subscription to users who signed up with my referral code
  useEffect(() => {
    if (!profile?.referral_code) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('referred_by', '==', profile.referral_code)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const members = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as TeamMember[];

        // Sort newest first
        members.sort((a, b) => {
          const at = a.created_at?.toDate?.()?.getTime?.() || 0;
          const bt = b.created_at?.toDate?.()?.getTime?.() || 0;
          return bt - at;
        });

        setTeam(members);
        setLoading(false);
      },
      (err) => {
        console.error('Team subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [profile?.referral_code]);

  if (!profile) return null;

  const referralLink = `${window.location.origin}/signup?ref=${profile.referral_code}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ⭐ Real stats
  const totalReferrals = team.length;
  const activeMembers = team.filter((m) => (m.portfolio_value || 0) > 0).length;
  const totalEarnings = profile.total_referral_earnings || 0;

  const stats = [
    { label: 'Total Referrals', value: totalReferrals, icon: UserPlus, color: 'text-gold' },
    { label: 'Active Members', value: activeMembers, icon: Users, color: 'text-emerald' },
    { label: 'Referral Earnings', value: formatNaira(totalEarnings), icon: TrendingUp, color: 'text-gold' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-3 mt-1">My Team</h2>

      {/* Referral card */}
      <div className="glass-card p-5 mb-4 relative overflow-hidden animate-slide-up">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gold/8 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
              <Gift size={18} className="text-gold" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Invite & Earn</h3>
              <p className="text-xs text-slate-400">Earn 40% of your referrals' first deposit</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-1.5">Your Referral Code</p>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 bg-midnight-50/70 border border-obsidian-border rounded-xl px-4 py-3">
              <span className="text-lg font-bold text-gold tracking-wider font-mono">{profile.referral_code}</span>
            </div>
            <button
              onClick={copyCode}
              className="w-12 h-12 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold hover:bg-gold/25 transition-colors"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-1.5">Shareable Link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-midnight-50/70 border border-obsidian-border rounded-xl px-3 py-2.5 truncate">
              <span className="text-xs text-slate-300">{referralLink}</span>
            </div>
            <button
              onClick={copyCode}
              className="btn-gold py-2.5 px-4 text-xs flex items-center gap-1.5"
            >
              <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          {/* Earnings hint */}
          <div className="mt-4 p-3 rounded-xl bg-emerald/5 border border-emerald/20 flex items-start gap-2">
            <TrendingUp size={14} className="text-emerald flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              You earn <span className="text-emerald font-semibold">40% commission</span> on each referral's
              first deposit. Paid out instantly to your wallet.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="glass-card p-3 text-center animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Icon size={18} className={`${s.color} mx-auto mb-1.5`} />
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Team list */}
      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center animate-fade-in">
          <div className="w-6 h-6 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <div className="glass-card p-8 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-obsidian-light/60 border border-obsidian-border flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">No team members yet</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Share your referral code above. When someone signs up with it, they'll appear here and
            you'll earn rewards.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b border-obsidian-border/40 flex items-center justify-between">
            <p className="text-xs font-semibold text-white">Team Members</p>
            <p className="text-[11px] text-slate-400">{team.length} total</p>
          </div>
          <div className="divide-y divide-obsidian-border/30">
            {team.map((member) => {
              const isActive = (member.portfolio_value || 0) > 0;
              const commissionEarned = member.referral_commission_paid ? 'Paid' : 'Pending';

              return (
                <div key={member.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-emerald/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gold">
                      {member.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>

                  {/* Name + phone */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {member.full_name || 'New Member'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {member.phone || '—'}
                    </p>
                  </div>

                  {/* Status + commission */}
                  <div className="text-right flex-shrink-0">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald/15 text-emerald border border-emerald/30">
                        <Zap size={9} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30">
                        <Clock size={9} /> Joined
                      </span>
                    )}
                    <p
                      className={`text-[10px] mt-1 font-semibold ${
                        member.referral_commission_paid ? 'text-emerald' : 'text-amber-400'
                      }`}
                    >
                      {commissionEarned}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}