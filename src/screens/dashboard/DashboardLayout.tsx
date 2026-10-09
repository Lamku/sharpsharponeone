import { useEffect, useRef, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { LogOut, Bell, TrendingUp, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, CalendarCheck, Clock, Sparkles, ChevronRight, AlertCircle, Building2, Shield, Info, Menu, Headphones, Send, Users, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { NotificationBanner } from '@/components/NotificationBar';
import { PlatformSettings, subscribeToSettings, DEFAULT_SETTINGS } from '@/lib/settings';
import { ManualDepositSection } from './ManualDepositSection';
import { notifyWithdrawal } from '@/lib/telegram';
import { SupportChat } from '@/components/SupportChat';
import { HeinekenMemorySection } from '@/components/HeinekenMemorySection';
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
import { SideDrawer } from './SideDrawer';
import { PaystackStorefront } from './PaystackStorefront';

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

const WITHDRAWAL_FEE_PERCENT = 15;
const MINIMUM_WITHDRAWAL = 400;
const WELCOME_BONUS = 500;
const WITHDRAWAL_LOCK_MS = 24 * 60 * 60 * 1000;

// Heineken-inspired color palette
const H = {
  green: '#007A33',
  greenDark: '#005A26',
  greenLight: '#00A04A',
  white: '#FFFFFF',
  offWhite: '#F5F7F5',
  lightGray: '#E8EDE8',
  textDark: '#0A2A1A',
  textMid: '#4A5A50',
};

// ⭐ Portfolio slide images (served from /public/portfolio/)
const PORTFOLIO_SLIDES = [
  '/portfolio/slide-1.png',
  '/portfolio/slide-2.png',
  '/portfolio/slide-3.png',
  '/portfolio/slide-4.png',
  '/portfolio/slide-5.png',
  '/portfolio/slide-6.png',
  '/portfolio/slide-7.png',
  '/portfolio/slide-8.png',
];

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

  // ⭐ Carousel state
  const [slideIndex, setSlideIndex] = useState(0);

  const accrualRunning = useRef(false);

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ⭐ Auto-advance carousel every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setSlideIndex((i) => (i + 1) % PORTFOLIO_SLIDES.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = subscribeToSettings((s) => setPlatformSettings(s));
    return () => unsub();
  }, []);

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

  // Yield accrual (unchanged)
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
            const investmentReads: Array<{ ref: any; data: Investment; update: UpdateData }> = [];

            for (const update of updates) {
              const ref = doc(db, 'investments', update.id);
              const invSnap = await transaction.get(ref);
              if (!invSnap.exists()) continue;
              investmentReads.push({ ref, data: invSnap.data() as Investment, update });
            }

            const userRef = doc(db, 'users', profile.id);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error('User not found');
            const userData = userSnap.data();

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
    const yieldInterval = setInterval(accrueYields, 60 * 1000);
    return () => clearInterval(yieldInterval);
  }, [profile, refreshProfile]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7F5]">
        <div className="w-10 h-10 rounded-full border-2 border-[#007A33]/30 border-t-[#007A33] animate-spin" />
      </div>
    );
  }

  const profileAny = profile as any;
  const lastWithdrawRaw = profileAny.last_withdrawal_at;
  const lastWithdrawDate: Date | null =
    lastWithdrawRaw?.toDate?.() ||
    (lastWithdrawRaw instanceof Date ? lastWithdrawRaw : null);

  const lastCheckIn = (() => {
    const v = profile.last_check_in;
    if (!v) return 0;
    if (typeof v?.toDate === 'function') return v.toDate().getTime();
    if (typeof v?.seconds === 'number') return v.seconds * 1000;
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
        if (!userSnap.exists()) throw new Error('User not found');

        const userData = userSnap.data();
        const rawLastCheckIn = userData?.last_check_in;
        let lastCheckInMs = 0;
        if (rawLastCheckIn) {
          if (typeof rawLastCheckIn?.toDate === 'function') lastCheckInMs = rawLastCheckIn.toDate().getTime();
          else if (typeof rawLastCheckIn?.seconds === 'number') lastCheckInMs = rawLastCheckIn.seconds * 1000;
          else if (rawLastCheckIn instanceof Date) lastCheckInMs = rawLastCheckIn.getTime();
          else if (typeof rawLastCheckIn === 'number') lastCheckInMs = rawLastCheckIn;
          else if (typeof rawLastCheckIn === 'string') {
            const d = new Date(rawLastCheckIn);
            lastCheckInMs = isNaN(d.getTime()) ? 0 : d.getTime();
          }
        }

        const now = new Date();
        const hoursSinceLastCheckIn = (now.getTime() - lastCheckInMs) / (1000 * 60 * 60);
        if (hoursSinceLastCheckIn < 24) throw new Error('Already checked in today');

        const bonusAmount = 200;
        transaction.update(userRef, {
          wallet_balance: (userData?.wallet_balance || 0) + bonusAmount,
          portfolio_value: (userData?.portfolio_value || 0) + bonusAmount,
          last_check_in: serverTimestamp(),
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
      setNow(Date.now());
    } catch (error: any) {
      const msg = error?.message || '';
      setCheckInMsg({
        ok: false,
        text: msg === 'Already checked in today' ? 'Already checked in today!' : 'Something went wrong. Try again.',
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
        if (!userSnap.exists()) throw new Error('User not found');

        const userData = userSnap.data();
        const currentBalance = userData?.wallet_balance || 0;
        if (currentBalance < amount) throw new Error('Insufficient balance');

        const freshLastWithdraw = userData?.last_withdrawal_at?.toDate?.();
        if (freshLastWithdraw) {
          const msSince = Date.now() - freshLastWithdraw.getTime();
          if (msSince < WITHDRAWAL_LOCK_MS) {
            const remaining = WITHDRAWAL_LOCK_MS - msSince;
            const hrs = Math.floor(remaining / (60 * 60 * 1000));
            const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            throw new Error(`You can only withdraw once every 24 hours. Next withdrawal in ${hrs}h ${mins}m.`);
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
          amount,
          fee,
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
          amount,
          type: 'withdrawal',
          description: `Withdrawal to ${bankName} (${accountNumber.slice(-4)})`,
          status: 'pending',
          created_at: serverTimestamp()
        });
      });

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

 const getGreeting = () => {
  const hour = new Date(now).getHours();   // ⬅️ depends on `now` state
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};
  return (
    <div className="min-h-screen pb-28 bg-[#F5F7F5]">
      {/* ============ HEADER (White + Green) ============ */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl bg-white border border-[#E8EDE8] flex items-center justify-center text-[#007A33] shadow-sm"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <Logo size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 rounded-xl bg-white border border-[#E8EDE8] flex items-center justify-center text-[#4A5A50] shadow-sm">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00A04A]" />
          </button>
          <button
            onClick={signOut}
            className="w-9 h-9 rounded-xl bg-white border border-[#E8EDE8] flex items-center justify-center text-[#4A5A50] shadow-sm"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="px-5 max-w-md mx-auto">
        <NotificationBanner />

       {/* ============ WELCOME GREETING ============ */}
<div className="flex items-center justify-between mb-4 animate-slide-up">
  <div>
    <h1
      key={getGreeting()}
      className="text-xl font-extrabold text-[#0A2A1A] animate-fade-in"
    >
      {getGreeting()}!
    </h1>
    <p className="text-xs text-[#4A5A50]">
      {profile.full_name?.split(' ')[0] || 'Welcome back'}
    </p>
  </div>
  <div className="bg-white border border-[#E8EDE8] rounded-full px-4 py-2 shadow-sm">
    <span className="text-xs text-[#4A5A50] font-medium">Balance </span>
    <span className="text-sm font-bold text-[#007A33]">
      {formatNaira(profile.wallet_balance)}
    </span>
  </div>
</div>

        {/* ============ HERO BANNER (Green + Sliding Images) ============ */}
        <div className="rounded-3xl p-5 mb-4 relative overflow-hidden animate-slide-up shadow-lg">

          {/* ⭐ Sliding background images (fade transition every 3s) */}
          <div className="absolute inset-0 overflow-hidden rounded-3xl">
            {PORTFOLIO_SLIDES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Portfolio ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
                style={{ opacity: i === slideIndex ? 1 : 0 }}
                draggable={false}
              />
            ))}
          </div>

          {/* ⭐ Very light overlay — image stays clearly visible */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55 rounded-3xl" />

          {/* ⭐ Extra top-only green tint so "Total Balance" label pops */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#007A33]/50 to-transparent rounded-t-3xl" />

          <div className="relative">
            <p
              className="text-[11px] uppercase tracking-widest text-white font-semibold mb-1"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
            >
              Total Balance
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span
                className="text-3xl font-extrabold text-white tracking-tight"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.9)' }}
              >
                {formatNaira(profile.portfolio_value)}
              </span>
              <span
                className="flex items-center gap-0.5 text-xs text-white font-semibold"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              >
                <TrendingUp size={12} /> 0.0%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeposit(true)}
                className="flex items-center justify-center gap-2 py-3 text-sm rounded-2xl bg-white text-[#007A33] font-bold shadow-md hover:bg-[#F5F7F5] transition-all"
              >
                <ArrowDownToLine size={16} /> Deposit
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                disabled={!canWithdraw}
                className={`flex items-center justify-center gap-2 py-3 text-sm rounded-2xl font-bold transition-all backdrop-blur-sm ${
                  canWithdraw
                    ? 'bg-white/25 text-white border border-white/50 hover:bg-white/35'
                    : 'bg-white/10 text-white/50 border border-white/20 cursor-not-allowed'
                }`}
              >
                <ArrowUpFromLine size={16} /> Withdraw
              </button>
            </div>

            {!canWithdraw && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-black/30 backdrop-blur-sm border border-white/20 flex items-center gap-2">
                <Clock size={13} className="text-white flex-shrink-0" />
                <span className="text-[11px] text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                  Next withdrawal available in{' '}
                  <span className="font-bold font-mono">
                    {withdrawLockHours}h {withdrawLockMinutes}m
                  </span>
                </span>
              </div>
            )}

            {/* ⭐ Slide indicator dots (on translucent pill for visibility) */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
                {PORTFOLIO_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlideIndex(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === slideIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ============ EXPLORE OUR SERVICES ============ */}
        <h2 className="text-base font-bold text-[#0A2A1A] mb-3 animate-slide-up">
          Explore Our Services
        </h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Telegram Support */}
          <button
            onClick={() => {
              const api = (window as any).Tawk_API;
              if (api?.maximize) api.maximize();
              else alert('Support chat is loading. Please try again in a moment.');
            }}
            className="bg-white rounded-2xl p-4 border border-[#E8EDE8] shadow-sm text-left hover:shadow-md transition-all animate-slide-up"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007A33]/15 to-[#00A04A]/10 border border-[#007A33]/20 flex items-center justify-center mb-3">
              <Headphones size={18} className="text-[#007A33]" />
            </div>
            <p className="text-sm font-bold text-[#0A2A1A] mb-0.5">Telegram service</p>
            <p className="text-[11px] text-[#4A5A50]">Chat with our support team</p>
          </button>

          {/* Telegram Group */}
          <a
            href="https://t.me/+BHDMWqhc2uJjNDM0"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl p-4 border border-[#E8EDE8] shadow-sm text-left hover:shadow-md transition-all animate-slide-up"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007A33]/15 to-[#00A04A]/10 border border-[#007A33]/20 flex items-center justify-center mb-3">
              <Send size={18} className="text-[#007A33]" />
            </div>
            <p className="text-sm font-bold text-[#0A2A1A] mb-0.5">Telegram group</p>
            <p className="text-[11px] text-[#4A5A50]">Join the community channel</p>
          </a>
        </div>

        {/* ============ FULL-WIDTH CTA BANNER ============ */}
        {/* <div className="rounded-3xl p-5 mb-4 bg-gradient-to-r from-[#007A33] to-[#005A26] shadow-lg animate-slide-up">
          <p className="text-sm font-bold text-white text-center leading-relaxed">
            We're building the future of real estate investing in Nigeria.
            <br />
            Join thousands building wealth with us.
          </p>
        </div> */}

        {/* ============ DAILY CHECK-IN ============ */}
        <div className="bg-white rounded-2xl p-4 mb-4 border border-[#E8EDE8] shadow-sm animate-slide-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#007A33]/20 to-[#00A04A]/10 border border-[#007A33]/30 flex items-center justify-center">
                <CalendarCheck size={20} className="text-[#007A33]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0A2A1A]">Daily Check-In</p>
                <p className="text-xs text-[#4A5A50]">
                  {canCheckIn ? 'Claim your ₦200 bonus now' : 'Next bonus available in'}
                </p>
              </div>
            </div>
            <div className="text-right">
              {canCheckIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={checkInLoading}
                  className="py-2.5 px-4 text-xs font-bold rounded-xl text-white animate-pulse-gold"
                  style={{ backgroundColor: H.green }}
                >
                  {checkInLoading ? 'Claiming...' : 'Claim ₦200'}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-[#4A5A50]">
                  <Clock size={14} />
                  <span className="font-mono text-sm tabular-nums">{formatCountdown(timeUntilNext)}</span>
                </div>
              )}
            </div>
          </div>
          {checkInMsg && (
            <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
              checkInMsg.ok
                ? 'bg-[#007A33]/10 text-[#007A33] border border-[#007A33]/30'
                : 'bg-red-500/10 text-red-500 border border-red-500/30'
            }`}>
              {checkInMsg.text}
            </div>
          )}
        </div>

        {/* ============ WHY CHOOSE US ============ */}
        <div className="flex items-center gap-2 mb-3 animate-slide-up">
          <div className="w-1 h-5 rounded-full bg-[#007A33]" />
          <h2 className="text-base font-bold text-[#0A2A1A]">Why Choose Us</h2>
        </div>

        <div className="space-y-2 mb-4">
          {[
            { icon: Shield, label: 'Secure Protection', desc: 'Multi-layer fund security' },
            { icon: Zap, label: 'Instant Credit', desc: 'Earnings credited in seconds' },
            { icon: Headphones, label: 'Dedicated Support', desc: '24/7 customer service' },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-4 border border-[#E8EDE8] shadow-sm flex items-center gap-3 animate-slide-up"
              style={{ animationDelay: `${100 + i * 40}ms` }}
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#007A33]/15 to-[#00A04A]/10 border border-[#007A33]/20 flex items-center justify-center flex-shrink-0">
                <Icon size={20} className="text-[#007A33]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0A2A1A]">{label}</p>
                <p className="text-[11px] text-[#4A5A50]">{desc}</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#007A33] text-white text-[10px] font-bold">
                On
              </div>
            </div>
          ))}
        </div>

         {/* ⭐ NEW: Heineken Memory Section */}
        <HeinekenMemorySection />

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
                <p className="text-sm text-[#0A2A1A] font-semibold mb-1">Deposits temporarily disabled</p>
                <p className="text-xs text-[#4A5A50]">Please try again later.</p>
                <button onClick={() => setShowDeposit(false)} className="btn-ghost w-full mt-5 py-3 text-sm">
                  Close
                </button>
              </div>
            )}

            {platformSettings.paystackEnabled && platformSettings.manualDepositEnabled && (
              <DepositTabs
                paystack={<PaystackStorefront settings={platformSettings} onClose={() => setShowDeposit(false)} />}
                manual={<ManualDepositSection settings={platformSettings} onClose={() => setShowDeposit(false)} />}
              />
            )}

            {platformSettings.paystackEnabled && !platformSettings.manualDepositEnabled && (
              <PaystackStorefront settings={platformSettings} onClose={() => setShowDeposit(false)} />
            )}

            {!platformSettings.paystackEnabled && platformSettings.manualDepositEnabled && (
              <ManualDepositSection settings={platformSettings} onClose={() => setShowDeposit(false)} />
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

      <SupportChat />
    </div>
  );
}

// ============ DEPOSIT TABS ============
function DepositTabs({ paystack, manual }: { paystack: React.ReactNode; manual: React.ReactNode }) {
  const [tab, setTab] = useState<'paystack' | 'manual'>('paystack');
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-[#F5F7F5] border border-[#E8EDE8]">
        <button
          onClick={() => setTab('paystack')}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'paystack' ? 'bg-[#007A33] text-white' : 'text-[#4A5A50]'
          }`}
        >
          Paystack
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'manual' ? 'bg-[#007A33] text-white' : 'text-[#4A5A50]'
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
    if (!hasBoughtProduct && amountNum > max) { setShowWelcomeBonusWarning(true); return; }
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
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#007A33]/15 border border-[#007A33]/40 flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-[#007A33]" />
            </div>
            <h2 className="text-lg font-bold text-[#0A2A1A] mb-2">Welcome Bonus Locked</h2>
           <p className="text-sm text-[#4A5A50] mb-5">
  Your <span className="text-[#007A33] font-semibold">₦500 welcome bonus</span> cannot be withdrawn yet.
  Purchase an investment product first to unlock it.
</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 text-sm rounded-xl border border-[#E8EDE8] text-[#4A5A50]">Close</button>
              <button onClick={onClose} className="flex-1 py-3 text-sm rounded-xl bg-[#007A33] text-white font-bold">Buy Product</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'bank') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 rounded-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-[#0A2A1A] mb-1">Select Bank</h2>
          <p className="text-xs text-[#4A5A50] mb-4">Choose your bank for withdrawal</p>
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search banks..."
              className="w-full bg-[#F5F7F5] border border-[#E8EDE8] rounded-xl px-4 py-2.5 text-sm text-[#0A2A1A] outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            <div className="space-y-2">
              {filteredBanks.map((bank) => (
                <button
                  key={bank.code}
                  onClick={() => handleBankSelect(bank)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#F5F7F5] border border-[#E8EDE8]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E8EDE8] flex items-center justify-center">
                    <Building2 size={18} className="text-[#007A33]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-[#0A2A1A]">{bank.name}</p>
                  </div>
                  <ChevronRight size={18} className="text-[#4A5A50]" />
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-full mt-4 py-3 text-sm rounded-xl border border-[#E8EDE8] text-[#4A5A50]">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setStep('bank')} className="w-9 h-9 rounded-xl bg-[#F5F7F5] border border-[#E8EDE8] flex items-center justify-center text-[#007A33]">
            <ChevronRight size={18} className="rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#F5F7F5] border border-[#E8EDE8] flex items-center justify-center">
              <Building2 size={16} className="text-[#007A33]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0A2A1A]">{selectedBank?.name}</p>
              <p className="text-[10px] text-[#4A5A50]">Selected Bank</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-[#4A5A50] uppercase tracking-wide mb-1.5">Account Number</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="0123456789"
            className="w-full bg-[#F5F7F5] border border-[#E8EDE8] rounded-xl px-4 py-3 text-sm text-[#0A2A1A] outline-none"
          />
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-[#4A5A50] uppercase tracking-wide mb-1.5">Account Name</label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="John Doe"
            className="w-full bg-[#F5F7F5] border border-[#E8EDE8] rounded-xl px-4 py-3 text-sm text-[#0A2A1A] outline-none"
          />
        </div>

        <div className="mb-2">
          <label className="block text-[11px] font-semibold text-[#4A5A50] uppercase tracking-wide mb-1.5">Amount (₦)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[#F5F7F5] border border-[#E8EDE8] rounded-xl px-4 py-3 text-lg font-semibold text-[#0A2A1A] outline-none"
          />
          <p className="text-xs text-[#4A5A50] mt-1.5">
            Available: <span className="text-[#007A33] font-semibold">{formatNaira(max)}</span>
          </p>
        </div>

       <div className="grid grid-cols-4 gap-2 mb-4">
  {[400, 5000, 10000, 50000].map((v) => (
    <button
      key={v}
      onClick={() => setAmount(String(v))}
      className="text-xs py-2 rounded-lg bg-[#F5F7F5] border border-[#E8EDE8] text-[#4A5A50]"
    >
      ₦{v.toLocaleString()}
    </button>
  ))}
</div>

        {amountNum > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-[#F5F7F5] border border-[#E8EDE8] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#4A5A50]">Withdrawal Amount</span>
              <span className="text-[#0A2A1A] font-semibold">{formatNaira(amountNum)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#4A5A50]">Processing Fee ({WITHDRAWAL_FEE_PERCENT}%)</span>
              <span className="text-red-500 font-semibold">-{formatNaira(fee)}</span>
            </div>
            <div className="border-t border-[#E8EDE8] pt-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#4A5A50]">You'll Receive</span>
              <span className="text-lg font-bold text-[#007A33]">{formatNaira(netAmount)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-sm rounded-xl border border-[#E8EDE8] text-[#4A5A50]">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || belowMinimum || amountNum <= 0}
            className="flex-1 py-3 text-sm rounded-xl bg-[#007A33] text-white font-bold disabled:opacity-50"
          >
            {loading ? 'Processing...' : `Withdraw ${formatNaira(netAmount > 0 ? netAmount : 0)}`}
          </button>
        </div>
      </div>
    </div>
  );
}