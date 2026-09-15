import { useEffect, useRef, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { LogOut, Bell, TrendingUp, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, CalendarCheck, Clock, Sparkles, ChevronRight, AlertCircle, Building2, Shield, Info, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { NotificationBanner } from '@/components/NotificationBar';
import { PlatformSettings, subscribeToSettings, DEFAULT_SETTINGS } from '@/lib/settings';
import { ManualDepositSection } from './ManualDepositSection';
import { notifyWithdrawal } from '@/lib/telegram';
import { TelegramButton } from '@/components/TelegramButton';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { formatNaira, formatCountdown } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { BottomNav, type TabKey } from '@/components/BottomNav';
import { DepositSection } from './DepositSection';
import { SideDrawer } from './SideDrawer';

interface Investment {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name?: string;
  amount: number;
  daily_yield: number;
  total_return: number;
  duration_days?: number;
  active: boolean;
  start_date: any;
  end_date: any;
  last_yield_date: any;
  accrued_yield: number;
  created_at: any;
}

interface UpdateData {
  id: string;
  lastYieldDate: Date;
  accrued_yield: number;
}

const NIGERIAN_BANKS = [
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '50515', name: 'Moniepoint Microfinance Bank' },
  { code: '50211', name: 'Kuda Bank' },
  { code: '044', name: 'Access Bank' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '057', name: 'Zenith Bank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '032', name: 'Union Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '035', name: 'Wema Bank (ALAT)' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '214', name: 'FCMB' },
  { code: '082', name: 'Keystone Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '100', name: 'SunTrust Bank' },
];

const WITHDRAWAL_FEE_PERCENT = 18;
const MINIMUM_WITHDRAWAL = 1500;
const WELCOME_BONUS = 1500;
const WITHDRAWAL_LOCK_MS = 24 * 60 * 60 * 1000;

export function DashboardLayout() {
  const { profile, session, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('products');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [userInvestments, setUserInvestments] = useState<Investment[]>([]);
  const [hasDeposited, setHasDeposited] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);

  // ⭐ Prevent overlapping accrual runs
  const accrualRunning = useRef(false);

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = subscribeToSettings((s) => setPlatformSettings(s));
    return () => unsub();
  }, []);

  // Load user's investments and check deposit history
  useEffect(() => {
    if (!profile) return;

    const loadUserData = async () => {
      try {
        const investmentsQuery = query(
          collection(db, 'investments'),
          where('user_id', '==', profile.id)
        );
        const investmentsSnap = await getDocs(investmentsQuery);
        const investments = investmentsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Investment[];
        setUserInvestments(investments);

        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('user_id', '==', profile.id),
          where('type', '==', 'deposit')
        );
        const transactionsSnap = await getDocs(transactionsQuery);
        setHasDeposited(!transactionsSnap.empty);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [profile]);

  // ⭐ CLIENT-SIDE YIELD ACCRUAL
  useEffect(() => {
    if (!profile) return;

    const accrueYields = async () => {
      if (accrualRunning.current) return;
      accrualRunning.current = true;

      try {
        const investmentsQuery = query(
          collection(db, 'investments'),
          where('user_id', '==', profile.id),
          where('active', '==', true)
        );
        const investmentsSnap = await getDocs(investmentsQuery);

        let totalYield = 0;
        const updates: UpdateData[] = [];

        for (const docSnap of investmentsSnap.docs) {
          const investment = docSnap.data() as Investment;
          const lastYieldDate = investment.last_yield_date?.toDate?.() || new Date(0);
          const nowDate = new Date();
          const daysSinceLastYield = Math.floor(
            (nowDate.getTime() - lastYieldDate.getTime()) / (24 * 60 * 60 * 1000)
          );

          if (daysSinceLastYield >= 1) {
            const dailyYield = investment.daily_yield || 0;
            const durationDays = investment.duration_days || 0;
            const totalReturn = investment.total_return || dailyYield * durationDays;
            const accruedSoFar = investment.accrued_yield || 0;

            const remaining = Math.max(0, totalReturn - accruedSoFar);
            let yieldToCredit = dailyYield * daysSinceLastYield;
            if (yieldToCredit > remaining) yieldToCredit = remaining;

            if (yieldToCredit <= 0) continue;

            totalYield += yieldToCredit;

            updates.push({
              id: docSnap.id,
              lastYieldDate: nowDate,
              accrued_yield: accruedSoFar + yieldToCredit,
            });
          }
        }

        if (updates.length > 0 && totalYield > 0) {
          await runTransaction(db, async (transaction) => {
            // ============ ALL READS FIRST ============
            const investmentReads: Array<{
              ref: any;
              data: Investment;
              update: UpdateData;
            }> = [];

            for (const update of updates) {
              const ref = doc(db, 'investments', update.id);
              const invSnap = await transaction.get(ref);   // READ
              if (!invSnap.exists()) continue;
              investmentReads.push({
                ref,
                data: invSnap.data() as Investment,
                update,
              });
            }

            const userRef = doc(db, 'users', profile.id);
            const userSnap = await transaction.get(userRef);  // READ
            if (!userSnap.exists()) throw new Error('User not found');
            const userData = userSnap.data();

            // ============ NOW ALL WRITES ============
            for (const { ref, data: invData, update } of investmentReads) {
              const durationDays = invData.duration_days || 0;
              const totalReturn = invData.total_return || (invData.daily_yield || 0) * durationDays;
              const isCompleted = update.accrued_yield >= totalReturn;

              transaction.update(ref, {
                last_yield_date: update.lastYieldDate,
                accrued_yield: update.accrued_yield,
                active: !isCompleted,
              });
            }

            transaction.update(userRef, {
              wallet_balance: (userData?.wallet_balance || 0) + totalYield,
              portfolio_value: (userData?.portfolio_value || 0) + totalYield,
            });

            const transactionRef = doc(collection(db, 'transactions'));
            transaction.set(transactionRef, {
              user_id: profile.id,
              amount: totalYield,
              type: 'yield',
              description: `Daily yield accrual (${updates.length} investment${updates.length > 1 ? 's' : ''})`,
              status: 'successful',
              created_at: serverTimestamp(),
            });
          });

          await refreshProfile();
        }
      } catch (error) {
        console.error('Error accruing yields:', error);
      } finally {
        accrualRunning.current = false;
      }
    };

    accrueYields();

    // ⭐ Also run every 60 seconds while the user is on the site
    const yieldInterval = setInterval(accrueYields, 60 * 1000);

    return () => clearInterval(yieldInterval);
  }, [profile, refreshProfile]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
      </div>
    );
  }

  const profileAny = profile as any;
  const lastWithdrawRaw = profileAny.last_withdrawal_at;
  const lastWithdrawDate: Date | null =
    lastWithdrawRaw?.toDate?.() ||
    (lastWithdrawRaw instanceof Date ? lastWithdrawRaw : null);

 // ⭐ Safely convert last_check_in (Firestore Timestamp | Date | number | string) to ms
const lastCheckIn = (() => {
  const v = profile.last_check_in;
  if (!v) return 0;
  if (typeof v?.toDate === 'function') return v.toDate().getTime();  // Firestore Timestamp
  if (typeof v?.seconds === 'number') return v.seconds * 1000;        // raw Timestamp shape
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
})();
  const nextCheckIn = lastCheckIn + 24 * 60 * 60 * 1000;
  const canCheckIn = now >= nextCheckIn;
  const timeUntilNext = nextCheckIn - now;

  const msSinceLastWithdraw = lastWithdrawDate ? now - lastWithdrawDate.getTime() : Infinity;
  const canWithdraw = msSinceLastWithdraw >= WITHDRAWAL_LOCK_MS;
  const msUntilNextWithdraw = canWithdraw ? 0 : WITHDRAWAL_LOCK_MS - msSinceLastWithdraw;
  const withdrawLockHours = Math.floor(msUntilNextWithdraw / (60 * 60 * 1000));
  const withdrawLockMinutes = Math.floor((msUntilNextWithdraw % (60 * 60 * 1000)) / (60 * 1000));

    const handleCheckIn = async () => {
    if (!profile?.id) return;

    setCheckInLoading(true);
    setCheckInMsg(null);

    try {
      const result = await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.id);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          throw new Error('User not found');
        }

        const userData = userSnap.data();

        // ⭐ Safely read last_check_in (handles Firestore Timestamp, Date, number, string)
        const rawLastCheckIn = userData?.last_check_in;
        let lastCheckInMs = 0;
        if (rawLastCheckIn) {
          if (typeof rawLastCheckIn?.toDate === 'function') {
            lastCheckInMs = rawLastCheckIn.toDate().getTime();
          } else if (typeof rawLastCheckIn?.seconds === 'number') {
            lastCheckInMs = rawLastCheckIn.seconds * 1000;
          } else if (rawLastCheckIn instanceof Date) {
            lastCheckInMs = rawLastCheckIn.getTime();
          } else if (typeof rawLastCheckIn === 'number') {
            lastCheckInMs = rawLastCheckIn;
          } else if (typeof rawLastCheckIn === 'string') {
            const d = new Date(rawLastCheckIn);
            lastCheckInMs = isNaN(d.getTime()) ? 0 : d.getTime();
          }
        }

        const now = new Date();
        const hoursSinceLastCheckIn = (now.getTime() - lastCheckInMs) / (1000 * 60 * 60);

        if (hoursSinceLastCheckIn < 24) {
          throw new Error('Already checked in today');
        }

        const bonusAmount = 200;
        transaction.update(userRef, {
          wallet_balance: (userData?.wallet_balance || 0) + bonusAmount,
          portfolio_value: (userData?.portfolio_value || 0) + bonusAmount,
          last_check_in: serverTimestamp(),   // ⭐ use serverTimestamp for consistency
        });

        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          user_id: profile.id,
          amount: bonusAmount,
          type: 'check_in',
          description: 'Daily check-in bonus',
          status: 'successful',
          created_at: serverTimestamp(),
        });

        return { success: true, message: '₦200 check-in bonus claimed!' };
      });

      setCheckInMsg({ ok: true, text: result.message });
      await refreshProfile();
      // Force re-render so the countdown recomputes immediately
      setNow(Date.now());
    } catch (error: any) {
      const msg = error?.message || '';
      setCheckInMsg({
        ok: false,
        text:
          msg === 'Already checked in today'
            ? 'Already checked in today!'
            : 'Something went wrong. Try again.',
      });
    } finally {
      setCheckInLoading(false);
    }

    setTimeout(() => setCheckInMsg(null), 4000);
  };

  const handleWithdraw = async (
    amount: number,
    bankCode: string,
    bankName: string,
    accountNumber: string,
    accountName: string
  ) => {
    if (amount <= 0) return;

    if (!canWithdraw) {
      throw new Error(
        `You can only withdraw once every 24 hours. Next withdrawal in ${withdrawLockHours}h ${withdrawLockMinutes}m.`
      );
    }

    const fee = (amount * WITHDRAWAL_FEE_PERCENT) / 100;
    const netAmount = amount - fee;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.id);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          throw new Error('User not found');
        }

        const userData = userSnap.data();
        const currentBalance = userData?.wallet_balance || 0;

        if (currentBalance < amount) {
          throw new Error('Insufficient balance');
        }

        const freshLastWithdraw = userData?.last_withdrawal_at?.toDate?.();
        if (freshLastWithdraw) {
          const msSince = Date.now() - freshLastWithdraw.getTime();
          if (msSince < WITHDRAWAL_LOCK_MS) {
            const remaining = WITHDRAWAL_LOCK_MS - msSince;
            const hrs = Math.floor(remaining / (60 * 60 * 1000));
            const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            throw new Error(
              `You can only withdraw once every 24 hours. Next withdrawal in ${hrs}h ${mins}m.`
            );
          }
        }

        const hasBoughtProduct = userInvestments.some(inv => inv.amount > 0);

        if (!hasBoughtProduct) {
          const withdrawableAmount = Math.max(0, currentBalance - WELCOME_BONUS);
          if (amount > withdrawableAmount) {
            throw new Error(
              `You need to purchase an investment product before you can withdraw the ₦${WELCOME_BONUS.toLocaleString()} welcome bonus. Your withdrawable balance is ${formatNaira(withdrawableAmount)}.`
            );
          }
        }

        transaction.update(userRef, {
          wallet_balance: currentBalance - amount,
          portfolio_value: Math.max(0, (userData?.portfolio_value || 0) - amount),
          last_withdrawal_at: serverTimestamp(),
        });

        const withdrawalRef = doc(collection(db, 'withdrawals'));
        transaction.set(withdrawalRef, {
          user_id: profile.id,
          amount: amount,
          fee: fee,
          net_amount: netAmount,
          fee_percent: WITHDRAWAL_FEE_PERCENT,
          bank_code: bankCode,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          status: 'withdrawal_in_progress',
          created_at: serverTimestamp(),
        });

        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          user_id: profile.id,
          amount: amount,
          type: 'withdrawal',
          description: `Withdrawal to ${bankName} (${accountNumber.slice(-4)})`,
          status: 'pending',
          created_at: serverTimestamp()
        });
      });

      // ⭐ Telegram — notify admin of withdrawal request
      try {
        await notifyWithdrawal({
          userName: profile.full_name || 'Unknown',
          userPhone: profile.phone || 'N/A',
          amount,
          netAmount,
          bankName,
          accountNumber,
          accountName,
        });
      } catch (tErr) {
        console.warn('Telegram notify failed:', tErr);
      }

      await refreshProfile();
      setShowWithdraw(false);
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      throw error;
    }
  };

  const hasBoughtProduct = userInvestments.some(inv => inv.amount > 0);
  const eligibleBalance = hasBoughtProduct
    ? profile.wallet_balance
    : Math.max(0, profile.wallet_balance - WELCOME_BONUS);

  return (
    <div className="min-h-screen pb-28">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl bg-obsidian-light/60 border border-obsidian-border flex items-center justify-center text-slate-400 hover:text-gold transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <Logo size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 rounded-xl bg-obsidian-light/60 border border-obsidian-border flex items-center justify-center text-slate-400 hover:text-gold transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald" />
          </button>
          <button
            onClick={signOut}
            className="w-9 h-9 rounded-xl bg-obsidian-light/60 border border-obsidian-border flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="px-5 max-w-md mx-auto">
        <NotificationBanner />

        {/* Portfolio card with background image */}
        <div className="glass-card mb-4 relative overflow-hidden animate-slide-up">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/plan-7-victoria.jpg')" }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-black/85" />
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gold/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-emerald/10 blur-2xl" />

          <div className="relative p-5">
            <p className="text-xs text-slate-200 uppercase tracking-wider font-semibold mb-1 drop-shadow">
              Total Portfolio Value
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
                {formatNaira(profile.portfolio_value)}
              </span>
              <span className="flex items-center gap-0.5 text-xs text-emerald font-semibold">
                <TrendingUp size={12} /> 0.0%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5 text-slate-300 mb-1">
                  <WalletIcon size={13} />
                  <span className="text-[11px] font-medium">Wallet Balance</span>
                </div>
                <span className="text-lg font-bold text-gold">{formatNaira(profile.wallet_balance)}</span>
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5 text-slate-300 mb-1">
                  <Sparkles size={13} />
                  <span className="text-[11px] font-medium">Welcome Bonus</span>
                </div>
                <span className="text-lg font-bold text-emerald">₦1,500</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeposit(true)}
                className="btn-emerald flex items-center justify-center gap-2 py-3 text-sm"
              >
                <ArrowDownToLine size={16} /> Deposit
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                disabled={!canWithdraw}
                className={`flex items-center justify-center gap-2 py-3 text-sm rounded-xl transition-all ${
                  canWithdraw
                    ? 'btn-gold'
                    : 'bg-slate-800/60 border border-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                <ArrowUpFromLine size={16} /> Withdraw
              </button>
            </div>

            {!canWithdraw && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 backdrop-blur-sm flex items-center gap-2">
                <Clock size={13} className="text-amber-400 flex-shrink-0" />
                <span className="text-[11px] text-amber-200">
                  Next withdrawal available in{' '}
                  <span className="font-bold font-mono">
                    {withdrawLockHours}h {withdrawLockMinutes}m
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-4 mb-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold/20 to-emerald/10 border border-gold/30 flex items-center justify-center">
                <CalendarCheck size={20} className="text-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Daily Check-In</p>
                <p className="text-xs text-slate-400">
                  {canCheckIn ? 'Claim your ₦200 bonus now' : 'Next bonus available in'}
                </p>
              </div>
            </div>
            <div className="text-right">
              {canCheckIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={checkInLoading}
                  className="btn-emerald py-2.5 px-4 text-xs animate-pulse-gold"
                >
                  {checkInLoading ? 'Claiming...' : 'Claim ₦200'}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock size={14} />
                  <span className="font-mono text-sm tabular-nums">{formatCountdown(timeUntilNext)}</span>
                </div>
              )}
            </div>
          </div>
          {checkInMsg && (
            <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
              checkInMsg.ok ? 'bg-emerald/10 text-emerald border border-emerald/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
              {checkInMsg.text}
            </div>
          )}
        </div>

        <div className="animate-fade-in">
          <Outlet context={{ activeTab, setActiveTabDirect: (t: TabKey) => { setActiveTab(t); navigate(`/app/${t}`); } }} />
        </div>
      </main>

      <BottomNav active={activeTab} onChange={(t) => { setActiveTab(t); navigate(`/app/${t}`); }} />

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeTab={activeTab}
        onNavigate={(t) => setActiveTab(t)}
      />

      {showDeposit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowDeposit(false)}
        >
          <div
            className="glass-card w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {!platformSettings.paystackEnabled && !platformSettings.manualDepositEnabled && (
              <div className="text-center py-6">
                <AlertCircle size={32} className="text-amber-400 mx-auto mb-3" />
                <p className="text-sm text-white font-semibold mb-1">Deposits temporarily disabled</p>
                <p className="text-xs text-slate-400">Please try again later.</p>
                <button onClick={() => setShowDeposit(false)} className="btn-ghost w-full mt-5 py-3 text-sm">
                  Close
                </button>
              </div>
            )}

            {platformSettings.paystackEnabled && platformSettings.manualDepositEnabled && (
              <DepositTabs
                paystack={<DepositSection onClose={() => setShowDeposit(false)} />}
                manual={
                  <ManualDepositSection
                    settings={platformSettings}
                    onClose={() => setShowDeposit(false)}
                  />
                }
              />
            )}

            {platformSettings.paystackEnabled && !platformSettings.manualDepositEnabled && (
              <DepositSection onClose={() => setShowDeposit(false)} />
            )}

            {!platformSettings.paystackEnabled && platformSettings.manualDepositEnabled && (
              <ManualDepositSection
                settings={platformSettings}
                onClose={() => setShowDeposit(false)}
              />
            )}
          </div>
        </div>
      )}

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          onSubmit={handleWithdraw}
          max={eligibleBalance}
          hasBoughtProduct={hasBoughtProduct}
          walletBalance={profile.wallet_balance}
        />
      )}

       {/* ⭐ Draggable Telegram button */}
      <TelegramButton />
    </div>
  );
}

// ============ DEPOSIT TABS ============
function DepositTabs({ paystack, manual }: { paystack: React.ReactNode; manual: React.ReactNode }) {
  const [tab, setTab] = useState<'paystack' | 'manual'>('paystack');
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-midnight-50/60 border border-obsidian-border/40">
        <button
          onClick={() => setTab('paystack')}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'paystack' ? 'bg-emerald text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Paystack
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'manual' ? 'bg-emerald text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Bank Transfer
        </button>
      </div>
      {tab === 'paystack' ? paystack : manual}
    </div>
  );
}

// ============ WITHDRAWAL MODAL ============
function WithdrawModal({
  onClose,
  onSubmit,
  max,
  hasBoughtProduct,
  walletBalance,
}: {
  onClose: () => void;
  onSubmit: (amount: number, bankCode: string, bankName: string, accountNumber: string, accountName: string) => Promise<void>;
  max: number;
  hasBoughtProduct: boolean;
  walletBalance: number;
}) {
  const [step, setStep] = useState<'bank' | 'details'>('bank');
  const [selectedBank, setSelectedBank] = useState<{ code: string; name: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWelcomeBonusWarning, setShowWelcomeBonusWarning] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const fee = (amountNum * WITHDRAWAL_FEE_PERCENT) / 100;
  const netAmount = amountNum - fee;
  const belowMinimum = amountNum > 0 && amountNum < MINIMUM_WITHDRAWAL;

  const filteredBanks = NIGERIAN_BANKS.filter(bank =>
    bank.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBankSelect = (bank: { code: string; name: string }) => {
    setSelectedBank(bank);
    setStep('details');
  };

  const handleSubmit = async () => {
    setError(null);

    if (!selectedBank) { setError('Please select a bank'); return; }
    if (!accountNumber || accountNumber.length < 10) { setError('Please enter a valid 10-digit account number'); return; }
    if (!accountName.trim()) { setError('Please enter the account name'); return; }
    if (amountNum < MINIMUM_WITHDRAWAL) {
      setError(`Minimum withdrawal amount is ${formatNaira(MINIMUM_WITHDRAWAL)}`);
      return;
    }

    if (!hasBoughtProduct && amountNum > max) {
      setShowWelcomeBonusWarning(true);
      return;
    }

    if (amountNum > max) {
      setError(`Insufficient eligible balance. Available: ${formatNaira(max)}`);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(amountNum, selectedBank.code, selectedBank.name, accountNumber, accountName);
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed. Please try again.');
      setLoading(false);
    }
  };

  if (showWelcomeBonusWarning) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="glass-card w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-gold" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Welcome Bonus Locked</h2>
            <p className="text-sm text-slate-400 mb-5">
              Your <span className="text-gold font-semibold">₦1,500 welcome bonus</span> cannot be withdrawn yet.
              You need to purchase an investment product first to unlock it.
            </p>

            <div className="p-4 rounded-xl bg-midnight-50/50 border border-obsidian-border/40 mb-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Wallet Balance</span>
                <span className="text-sm font-semibold text-white">{formatNaira(walletBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Welcome Bonus (Locked)</span>
                <span className="text-sm font-semibold text-gold">{formatNaira(WELCOME_BONUS)}</span>
              </div>
              <div className="border-t border-obsidian-border/40 pt-2.5 flex items-center justify-between">
                <span className="text-xs text-slate-400">Withdrawable Amount</span>
                <span className="text-sm font-bold text-emerald">{formatNaira(max)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1 py-3 text-sm">Close</button>
              <button onClick={onClose} className="btn-gold flex-1 py-3 text-sm">Buy Product</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'bank') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="glass-card w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 animate-slide-up max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-white mb-1">Select Bank</h2>
          <p className="text-xs text-slate-400 mb-4">Choose your preferred bank for withdrawal</p>

          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search banks..."
              className="input-field text-sm"
            />
          </div>

          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            <div className="space-y-2">
              {filteredBanks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No banks found matching "{searchQuery}"
                </div>
              ) : (
                filteredBanks.map((bank) => (
                  <button
                    key={bank.code}
                    onClick={() => handleBankSelect(bank)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-midnight-50/50 border border-obsidian-border/40 hover:border-gold/40 hover:bg-midnight-50/80 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-obsidian-light/60 border border-obsidian-border flex items-center justify-center">
                      <Building2 size={18} className="text-gold" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">{bank.name}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-500" />
                  </button>
                ))
              )}
            </div>
          </div>

          <button onClick={onClose} className="btn-ghost w-full mt-4 py-3 text-sm">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setStep('bank')}
            className="w-9 h-9 rounded-xl bg-obsidian-light/60 border border-obsidian-border flex items-center justify-center text-slate-400 hover:text-gold transition-colors"
          >
            <ChevronRight size={18} className="rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-obsidian-light/60 border border-obsidian-border flex items-center justify-center">
              <Building2 size={16} className="text-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{selectedBank?.name}</p>
              <p className="text-[10px] text-slate-400">Selected Bank</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-3">
          <label className="label-text">Account Number</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="0123456789"
            className="input-field"
          />
        </div>

        <div className="mb-3">
          <label className="label-text">Account Name</label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="John Doe"
            className="input-field"
          />
        </div>

        <div className="mb-2">
          <label className="label-text">Amount (₦)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input-field text-lg font-semibold"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Available: <span className="text-gold font-semibold">{formatNaira(max)}</span>
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[1500, 5000, 10000, 50000].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="text-xs py-2 rounded-lg bg-midnight-50/60 border border-obsidian-border text-slate-300 hover:border-gold/40 hover:text-gold transition-colors"
            >
              ₦{v.toLocaleString()}
            </button>
          ))}
        </div>

        {amountNum > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-midnight-50/50 border border-obsidian-border/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Withdrawal Amount</span>
              <span className="text-white font-semibold">{formatNaira(amountNum)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Processing Fee ({WITHDRAWAL_FEE_PERCENT}%)</span>
              <span className="text-red-400 font-semibold">-{formatNaira(fee)}</span>
            </div>
            <div className="border-t border-obsidian-border/40 pt-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">You'll Receive</span>
              <span className="text-lg font-bold text-emerald">{formatNaira(netAmount)}</span>
            </div>
          </div>
        )}

        {belowMinimum && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-gold/10 border border-gold/30 text-xs text-gold flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>Minimum withdrawal amount is {formatNaira(MINIMUM_WITHDRAWAL)}</span>
          </div>
        )}

        {!hasBoughtProduct && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-gold/10 border border-gold/30 text-[11px] text-gold flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>Your ₦1,500 welcome bonus is locked. Purchase a product to unlock it.</span>
          </div>
        )}

        <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-500/5 border border-sky-500/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0">
              <Info size={16} className="text-sky-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-sky-300 mb-1">Withdrawal Information</p>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside">
                <li><span className="text-gold font-semibold">One withdrawal per 24 hours</span></li>
                <li>Withdrawals are processed within <span className="text-sky-300 font-semibold">5 minutes</span> after admin approval</li>
                <li>Your balance is deducted immediately when you submit</li>
                <li>A <span className="text-gold font-semibold">{WITHDRAWAL_FEE_PERCENT}%</span> processing fee applies</li>
                <li>Minimum withdrawal amount is <span className="text-gold font-semibold">{formatNaira(MINIMUM_WITHDRAWAL)}</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 py-3 text-sm">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || belowMinimum || amountNum <= 0}
            className="btn-gold flex-1 py-3 text-sm"
          >
            {loading ? 'Processing...' : `Withdraw ${formatNaira(netAmount > 0 ? netAmount : 0)}`}
          </button>
        </div>
      </div>
    </div>
  );
}