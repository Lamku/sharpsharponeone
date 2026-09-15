import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc,
  runTransaction,
  serverTimestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { formatNaira } from '@/lib/format';
import { Lock, TrendingUp, Clock, ArrowRight, CheckCircle2, AlertCircle, Loader2, MapPin, Sparkles, Calendar, Coins } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  cost: number;
  daily_yield: number;
  duration_days: number;
  total_return: number;
  locked: boolean;
  sort_order: number;
  description?: string;
}

interface Investment {
  id: string;
  user_id: string;
  plan_id: string;
  active: boolean;
  created_at: any;
}

// ============ 8 INVESTMENT PLANS ============
const DEFAULT_PLANS: Omit<Plan, 'id'>[] = [
  {
    name: 'Mowe Garden Estate',
    cost: 5000,
    daily_yield: 1000,
    duration_days: 100,
    total_return: 100000,
    locked: false,
    sort_order: 1,
    description: 'Prime residential plots in Mowe, Ogun State',
  },
  {
    name: 'Epe Waterfront',
    cost: 15000,
    daily_yield: 3333,
    duration_days: 100,
    total_return: 333300,
    locked: false,
    sort_order: 2,
    description: 'Waterfront properties in Epe, Lagos',
  },
  {
    name: 'Ibeju-Lekki Industrial',
    cost: 35000,
    daily_yield: 7200,
    duration_days: 100,
    total_return: 720000,
    locked: false,
    sort_order: 3,
    description: 'Industrial and commercial plots near Lekki Free Trade Zone',
  },
  {
    name: 'Lekki Phase 2',
    cost: 55000,
    daily_yield: 13250,
    duration_days: 100,
    total_return: 1325000,
    locked: false,
    sort_order: 4,
    description: 'Premium residential plots in Lekki Phase 2',
  },
  {
    name: 'Lekki Phase 1',
    cost: 100000,
    daily_yield: 26300,
    duration_days: 100,
    total_return: 2630000,
    locked: false,
    sort_order: 5,
    description: 'High-end residential plots in Lekki Phase 1',
  },
  {
    name: 'Banana Island Elite',
    cost: 200000,
    daily_yield: 55555,
    duration_days: 100,
    total_return: 5555500,
    locked: true,
    sort_order: 6,
    description: 'Exclusive luxury plots in Banana Island, Lagos',
  },
  {
    name: 'Victoria Crest',
    cost: 400000,
    daily_yield: 123300,
    duration_days: 100,
    total_return: 12330000,
    locked: true,
    sort_order: 7,
    description: 'Premium waterfront estate in Victoria Island',
  },
  {
    name: 'TerraVault Ultra',
    cost: 1000000000,
    daily_yield: 350000,
    duration_days: 100,
    total_return: 35000000,
    locked: true,
    sort_order: 8,
    description: 'Flagship luxury real estate investment',
  },
];

const PLAN_IMAGES: Record<string, string> = {
  'plan-1': 'https://i.ibb.co/m5QB1yzL/plan-1-mowe.jpg',
  'plan-2': 'https://i.ibb.co/XrP2wBs7/plan-2-epe.jpg',
  'plan-3': 'https://i.ibb.co/qFWHgfxt/plan-3-ibeju.jpg',
  'plan-4': 'https://i.ibb.co/67Ssf6gs/plan-4-lekki2.jpg',
  'plan-5': 'https://i.ibb.co/G42V9rPd/plan-5-lekki1.jpg',
  'plan-6': 'https://i.ibb.co/TBkXWGvj/plan-6-banana.jpg',
  'plan-7': 'https://i.ibb.co/svbPTMWy/plan-7-victoria.jpg',
  'plan-8': 'https://i.ibb.co/JjzjYcYN/plan-8-ogun.jpg',
   'terra-alpha': 'https://i.ibb.co/m5QB1yzL/plan-1-mowe.jpg',
  'terra-prime': 'https://i.ibb.co/XrP2wBs7/plan-2-epe.jpg',
};

const PLAN_LOCATIONS: Record<string, string> = {
  'plan-1': 'Mowe, Ogun',
  'plan-2': 'Epe, Lagos',
  'plan-3': 'Ibeju-Lekki, Lagos',
  'plan-4': 'Lekki Phase 2, Lagos',
  'plan-5': 'Lekki Phase 1, Lagos',
  'plan-6': 'Banana Island, Lagos',
  'plan-7': 'Victoria Island, Lagos',
  'plan-8': 'Ikoyi, Lagos',
  'terra-alpha': 'Abuja FCT',
  'terra-prime': 'Banana Island, Lagos',
};

export function ProductsScreen() {
  const { profile, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [modal, setModal] = useState<
    | { type: 'success'; planName: string }
    | { type: 'insufficient'; planName: string; cost: number; balance: number }
    | { type: 'error'; message: string }
    | null
  >(null);

  // Auto-seed plans using FIXED IDs — no duplicates possible
  const seedPlansIfNeeded = useCallback(async () => {
    try {
      console.log('🔍 Checking plans collection...');
      const plansSnap = await getDocs(collection(db, 'plans'));
      console.log('📊 Plans found:', plansSnap.size);

      if (plansSnap.size >= 8) {
        console.log('✅ All 8 plans already exist. Skipping seed.');
        return;
      }

      console.log('🌱 Seeding plans with fixed IDs...');
      setSeeding(true);

      for (let i = 0; i < DEFAULT_PLANS.length; i++) {
        const plan = DEFAULT_PLANS[i];
        const planId = `plan-${i + 1}`;
        const planRef = doc(db, 'plans', planId);

        await setDoc(planRef, {
          ...plan,
          created_at: serverTimestamp(),
        }, { merge: true });

        console.log('✅ Seeded:', planId, '-', plan.name);
      }

      console.log('🎉 All 8 plans seeded successfully!');
      setSeeding(false);
    } catch (error: any) {
      console.error('❌ Seed error:', error.code, error.message);
      setSeeding(false);
    }
  }, []);

  // Real-time listener for plans
  useEffect(() => {
    const plansQuery = query(
      collection(db, 'plans'),
      orderBy('sort_order', 'asc')
    );

    const unsubscribe = onSnapshot(
      plansQuery,
      (snap) => {
        const plansData = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Plan[];
        console.log('📥 Plans updated:', plansData.length);
        setPlans(plansData);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Plans listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time listener for user's investments
  useEffect(() => {
    if (!profile) return;

    const investmentsQuery = query(
      collection(db, 'investments'),
      where('user_id', '==', profile.id)
    );

    const unsubscribe = onSnapshot(
      investmentsQuery,
      (snap) => {
        const investmentsData = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Investment[];
        setInvestments(investmentsData);
      },
      (error) => {
        console.error('❌ Investments listener error:', error);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Seed plans on mount if needed
  useEffect(() => {
    seedPlansIfNeeded();
  }, [seedPlansIfNeeded]);

  const activePlanIds = new Set(investments.filter((i) => i.active).map((i) => i.plan_id));

  const handleBuy = async (plan: Plan) => {
    if (!profile) return;

    if (plan.locked) {
      setModal({ type: 'error', message: 'This plan is coming soon!' });
      return;
    }

    setPurchasing(plan.id);

    try {
      await runTransaction(db, async (transaction) => {
        // Check if user already owns this plan
        const existingInvestmentQuery = query(
          collection(db, 'investments'),
          where('user_id', '==', profile.id),
          where('plan_id', '==', plan.id),
          where('active', '==', true)
        );
        const existingSnap = await getDocs(existingInvestmentQuery);

        if (!existingSnap.empty) {
          throw new Error('You already own this plan');
        }

        const userRef = doc(db, 'users', profile.id);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          throw new Error('User not found');
        }

        const userData = userSnap.data();
        const currentBalance = userData.wallet_balance || 0;

        if (currentBalance < plan.cost) {
          throw new Error(`Insufficient balance. Need ₦${plan.cost.toLocaleString()}, have ₦${currentBalance.toLocaleString()}`);
        }

        // Deduct from wallet
        transaction.update(userRef, {
          wallet_balance: currentBalance - plan.cost,
        });

        // Create investment record
        const investmentRef = doc(collection(db, 'investments'));
        const now = new Date();
        const endDate = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

        transaction.set(investmentRef, {
          user_id: profile.id,
          plan_id: plan.id,
          plan_name: plan.name,
          amount: plan.cost,
          daily_yield: plan.daily_yield,
          total_return: plan.total_return,
          duration_days: plan.duration_days,
          active: true,
          start_date: now,
          end_date: endDate,
          last_yield_date: now,
          accrued_yield: 0,
          total_earned: 0,
          days_paid: 0,
          created_at: serverTimestamp(),
        });

        // Create transaction record
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          user_id: profile.id,
          amount: plan.cost,
          type: 'investment',
          description: `Purchase: ${plan.name}`,
          status: 'approved',
          created_at: serverTimestamp(),
        });
      });

      setModal({ type: 'success', planName: plan.name });
      await refreshProfile();
    } catch (error: any) {
      const errorMessage = error.message || '';
      console.error('Purchase error:', errorMessage);

      if (errorMessage.includes('Insufficient balance')) {
        setModal({
          type: 'insufficient',
          planName: plan.name,
          cost: plan.cost,
          balance: profile.wallet_balance,
        });
      } else if (errorMessage.includes('already own')) {
        setModal({ type: 'error', message: 'You already own this plan!' });
      } else {
        setModal({ type: 'error', message: 'Something went wrong. Please try again.' });
      }
    }

    setPurchasing(null);
  };

  if (loading || seeding) {
    return (
      <div className="space-y-4 mt-1">
        {seeding && (
          <div className="glass-card p-4 text-center">
            <Loader2 size={20} className="animate-spin text-gold mx-auto mb-2" />
            <p className="text-sm text-slate-400">Setting up investment plans...</p>
          </div>
        )}
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 mt-1">
        <div>
          <h2 className="text-lg font-bold text-white">Investment Plans</h2>
          <p className="text-xs text-slate-400">Fractional real estate investments</p>
        </div>
        <span className="text-xs text-slate-400">
          {plans.filter((p) => !p.locked).length} active
        </span>
      </div>

      <div className="space-y-4">
        {plans.map((plan, i) => {
          const image = PLAN_IMAGES[plan.id] || PLAN_IMAGES[`plan-${(i % 8) + 1}`] || PLAN_IMAGES['plan-1'];
          const location = PLAN_LOCATIONS[plan.id] || PLAN_LOCATIONS[`plan-${(i % 8) + 1}`] || 'Nigeria';
          const isActive = activePlanIds.has(plan.id);
          const isLocked = plan.locked;

          return (
            <div
              key={plan.id}
              className={`glass-card overflow-hidden animate-slide-up ${isLocked ? 'relative' : ''}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="relative h-36 overflow-hidden">
                <img
                  src={image}
                  alt={plan.name}
                  className={`w-full h-full object-cover ${isLocked ? 'grayscale opacity-50' : ''}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/50 to-transparent" />

                <div className="absolute top-3 left-3 flex gap-2">
                  {isLocked ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-700/80 text-slate-300 border border-slate-600/50 flex items-center gap-1">
                      <Lock size={11} /> Coming Soon
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/30 flex items-center gap-1">
                      <Sparkles size={11} /> Active
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald/15 text-emerald border border-emerald/30 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Owned
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-300">
                    <MapPin size={12} /> {location}
                  </div>
                </div>

                {isLocked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-midnight/70 backdrop-blur-[2px]">
                    <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-600/50 flex items-center justify-center mb-2">
                      <Lock size={22} className="text-slate-400" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">Coming Soon</p>
                  </div>
                )}
              </div>

              <div className="p-4">
                {!isLocked ? (
                  <>
                    {/* Investment breakdown */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Invest</p>
                        <p className="text-sm font-bold text-white">{formatNaira(plan.cost)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Daily</p>
                        <p className="text-sm font-bold text-emerald flex items-center gap-0.5">
                          <TrendingUp size={11} /> {formatNaira(plan.daily_yield)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Duration</p>
                        <p className="text-sm font-bold text-slate-300 flex items-center gap-0.5">
                          <Clock size={11} /> {plan.duration_days}d
                        </p>
                      </div>
                    </div>

                    {/* Total income display */}
                    <div className="flex items-center justify-between mb-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-gold/10 to-emerald/10 border border-gold/30">
                      <div className="flex items-center gap-2">
                        <Coins size={14} className="text-gold" />
                        <span className="text-xs text-slate-300">Total Income</span>
                      </div>
                      <span className="text-base font-extrabold text-gold">
                        {formatNaira(plan.total_return)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleBuy(plan)}
                      disabled={purchasing === plan.id}
                      className={
                        isActive
                          ? 'btn-ghost w-full flex items-center justify-center gap-2 text-sm'
                          : 'btn-gold w-full flex items-center justify-center gap-2 text-sm'
                      }
                    >
                      {purchasing === plan.id ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Processing...
                        </>
                      ) : isActive ? (
                        <>
                          <CheckCircle2 size={16} /> Active — View in Wallet
                        </>
                      ) : (
                        <>
                          Buy <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Entry Cost</p>
                      <p className="text-sm font-bold text-slate-400">{formatNaira(plan.cost)}</p>
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-midnight-50/40 border border-obsidian-border/40">
                      <Lock size={13} /> Locked
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal && <Modal modal={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function Modal({
  modal,
  onClose,
}: {
  modal:
    | { type: 'success'; planName: string }
    | { type: 'insufficient'; planName: string; cost: number; balance: number }
    | { type: 'error'; message: string };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md mx-4 mb-4 sm:mb-0 p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {modal.type === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald/15 border border-emerald/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1.5">Purchase Successful</h2>
            <p className="text-sm text-slate-400 mb-5">
              You've purchased{' '}
              <span className="text-gold font-semibold">{modal.planName}</span>. Daily yields
              are now active and will be credited to your wallet every 24 hours.
            </p>
            <button onClick={onClose} className="btn-emerald w-full">
              Great!
            </button>
          </div>
        )}

        {modal.type === 'insufficient' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-gold" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1.5">Insufficient Balance</h2>
            <p className="text-sm text-slate-400 mb-5">
              You need{' '}
              <span className="text-gold font-semibold">{formatNaira(modal.cost)}</span> to
              purchase <span className="text-white font-semibold">{modal.planName}</span>, but
              your wallet balance is{' '}
              <span className="text-red-400 font-semibold">{formatNaira(modal.balance)}</span>.
              <br />
              <br />
              Please top up your wallet via the Deposit section.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1 text-sm">
                Later
              </button>
              <button
                onClick={onClose}
                className="btn-gold flex-1 text-sm flex items-center justify-center gap-1.5"
              >
                <Calendar size={15} /> Top Up
              </button>
            </div>
          </div>
        )}

        {modal.type === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1.5">Something went wrong</h2>
            <p className="text-sm text-slate-400 mb-5">{modal.message}</p>
            <button onClick={onClose} className="btn-ghost w-full">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}