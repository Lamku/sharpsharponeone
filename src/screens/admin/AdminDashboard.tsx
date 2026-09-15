import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, ArrowDownToLine, ArrowUpFromLine, TrendingUp,
  LogOut, Search, CheckCircle2, XCircle, Clock, Wallet,
  Eye, Ban, RefreshCw, ChevronRight, Plus, Pencil, Trash2,
  Send, Bell, Package, Menu, X, UserCheck, UserX, Activity,
  Lock, Unlock, History, Gift, Sparkles, Settings, DollarSign, 
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { db } from '@/lib/firebase';
import { AdminGiftCodes } from './AdminGiftCodes';
import { AdminSettings } from './AdminSettings';
import { getPlatformSettings } from '@/lib/settings';
import { NOTIFICATION_TEMPLATES, getTemplatesByCategory } from '@/lib/notificationTemplates';
import { payReferralCommission } from '@/lib/referral';
import {
  collection, query, getDocs, doc, updateDoc, addDoc, deleteDoc,
  where, serverTimestamp, runTransaction, onSnapshot, getDoc,
} from 'firebase/firestore';
import { formatNaira, formatTimeAgo } from '@/lib/format';

// ============ CONSTANTS ============
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const BANK_CODES: Record<string, string> = {
  'OPay': '999992',
  'PalmPay': '999991',                                     // ← fixed case
  'Moniepoint Microfinance Bank': '50515',
  'Access Bank': '044',
  'Zenith Bank': '057',
  'Guaranty Trust Bank (GTBank)': '058',
  'First Bank of Nigeria': '011',
  'United Bank for Africa (UBA)': '033',
  'Kuda Bank': '50211',
  'Fidelity Bank': '070',
  'Union Bank': '032',
  'Stanbic IBTC Bank': '221',
  'Sterling Bank': '232',
  'Wema Bank (ALAT)': '035',
  'FCMB': '214',
  'Ecobank Nigeria': '050',
  'Keystone Bank': '082',
  'Polaris Bank': '076',
  'Jaiz Bank': '301',
  'SunTrust Bank': '100',
  'Providus Bank': '101',                                  // ← added
  'Citibank Nigeria': '023',                               // ← added
};

function getBankCode(bankName: string): string {
  return BANK_CODES[bankName] || '';
}

// ============ TYPES ============
interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  wallet_balance: number;
  portfolio_value: number;
  referral_code: string;
  welcome_bonus_claimed: boolean;
  is_suspended?: boolean;
  created_at: any;
}

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  bank_name: string;
  bank_code?: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'successful' | 'failed' | 'withdrawal_in_progress';
  paystack_recipient_code?: string;
  paystack_transfer_code?: string;
  created_at: any;
  userName?: string;
  userPhone?: string;
}

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  method?: 'paystack' | 'bank_transfer' | 'manual' | 'refund';
  description: string;
  status?: 'pending' | 'approved' | 'rejected' | 'successful' | 'failed';
  created_at: any;
  userName?: string;
  userPhone?: string;
}

interface Plan {
  id: string;
  name: string;
  cost: number;
  daily_yield: number;
  duration_days: number;
  total_return: number;
  locked: boolean;
  sort_order: number;
  description: string;
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: any;
  status?: string;
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'withdrawals'
  | 'deposits'
  | 'transactions'
  | 'plans'
  | 'notifications'
  | 'giftcodes'
  | 'settings';

export function AdminDashboard() {
  const { admin, adminLogout } = useAdminAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [planModal, setPlanModal] = useState<{ mode: 'create' | 'edit'; plan?: Plan } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Plan | null>(null);
  const [notifyModal, setNotifyModal] = useState<{ user: UserProfile } | null>(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBalance: 0,
    totalWithdrawn: 0,
    pendingWithdrawals: 0,
    pendingDeposits: 0,
    totalInvestments: 0,
  });

  // ============ LOAD DATA ============
  const loadAllData = useCallback(async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
      setUsers(usersData);

      const plansSnap = await getDocs(collection(db, 'plans'));
      const plansData = plansSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Plan[];
      setPlans(plansData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

      const withdrawalsSnap = await getDocs(collection(db, 'withdrawals'));
      const withdrawalsData = withdrawalsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Withdrawal[];

      const withdrawalsWithUsers = withdrawalsData.map(w => {
        const user = usersData.find(u => u.id === w.user_id);
        return {
          ...w,
          userName: user?.full_name || 'Unknown',
          userPhone: user?.phone || 'N/A',
        };
      }).sort((a, b) => {
        const aTime = a.created_at?.toDate?.()?.getTime() || 0;
        const bTime = b.created_at?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setWithdrawals(withdrawalsWithUsers);

      const depositsQuery = query(collection(db, 'transactions'), where('type', '==', 'deposit'));
      const depositsSnap = await getDocs(depositsQuery);
      const depositsData = depositsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Deposit[];

      const depositsWithUsers = depositsData.map(d => {
        const user = usersData.find(u => u.id === d.user_id);
        return {
          ...d,
          userName: user?.full_name || 'Unknown',
          userPhone: user?.phone || 'N/A',
        };
      }).sort((a, b) => {
        const aTime = a.created_at?.toDate?.()?.getTime() || 0;
        const bTime = b.created_at?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setDeposits(depositsWithUsers);

      const transactionsSnap = await getDocs(collection(db, 'transactions'));
      const transactionsData = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
      setTransactions(transactionsData.sort((a, b) => {
        const aTime = a.created_at?.toDate?.()?.getTime() || 0;
        const bTime = b.created_at?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      }));

      const totalBalance = usersData.reduce((sum, u) => sum + (u.wallet_balance || 0), 0);
      const approvedWithdrawals = withdrawalsWithUsers.filter(w => w.status === 'approved' || w.status === 'successful');
      const totalWithdrawn = approvedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
      const pendingWithdrawals = withdrawalsWithUsers.filter(
        w => w.status === 'pending' || w.status === 'withdrawal_in_progress'
      ).length;
      const pendingDeposits = depositsWithUsers.filter(
        d => d.status === 'pending' && d.method !== 'paystack'
      ).length;

      setStats({
        totalUsers: usersData.length,
        totalBalance,
        totalWithdrawn,
        pendingWithdrawals,
        pendingDeposits,
        totalInvestments: transactionsData.filter(t => t.type === 'investment').length,
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login', { replace: true });
      return;
    }
    loadAllData();
  }, [admin, navigate, loadAllData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };
  // ============ WITHDRAWAL ACTIONS (DUAL MODE) ============
  const handleWithdrawalAction = async (
    withdrawalId: string,
    action: 'approve' | 'reject' | 'mark_paid'
  ) => {
    setActionLoading(withdrawalId);
    try {
      const withdrawal = withdrawals.find((w) => w.id === withdrawalId);
      if (!withdrawal) return;

      const settings = await getPlatformSettings();

      // ============ REJECT ============
      if (action === 'reject') {
        await runTransaction(db, async (transaction) => {
          const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
          const userRef = doc(db, 'users', withdrawal.user_id);

          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw new Error('User not found');

          const userData = userSnap.data();
          const currentBalance = userData.wallet_balance || 0;

          transaction.update(userRef, {
            wallet_balance: currentBalance + withdrawal.amount,
            portfolio_value: (userData.portfolio_value || 0) + withdrawal.amount,
          });

          transaction.update(withdrawalRef, {
            status: 'failed',
            rejected_at: serverTimestamp(),
            rejected_by: admin?.phone || 'admin',
          });

          const refundRef = doc(collection(db, 'transactions'));
          transaction.set(refundRef, {
            user_id: withdrawal.user_id,
            amount: withdrawal.amount,
            type: 'deposit',
            method: 'refund',
            description: `Refund for rejected withdrawal`,
            status: 'successful',
            created_at: serverTimestamp(),
          });

          const notifRef = doc(collection(db, 'notifications'));
          transaction.set(notifRef, {
            user_id: withdrawal.user_id,
            title: '❌ Withdrawal Rejected',
            message: `Your withdrawal of ${formatNaira(withdrawal.amount)} was rejected. Funds have been refunded to your wallet.`,
            type: 'error',
            read: false,
            created_at: serverTimestamp(),
          });
        });

        alert('Withdrawal rejected. Funds refunded to user.');
        await loadAllData();
        setActionLoading(null);
        return;
      }

      // ============ MARK PAID (manual mode) ============
      if (action === 'mark_paid') {
        await updateDoc(doc(db, 'withdrawals', withdrawalId), {
          status: 'successful',
          paid_at: serverTimestamp(),
          paid_by: admin?.phone || 'admin',
          payment_method: 'manual',
        });

        const txQuery = query(
          collection(db, 'transactions'),
          where('user_id', '==', withdrawal.user_id),
          where('type', '==', 'withdrawal'),
          where('status', '==', 'pending')
        );
        const txSnap = await getDocs(txQuery);
        for (const txDoc of txSnap.docs) {
          const data = txDoc.data();
          if (Math.abs((data.amount || 0) - withdrawal.amount) < 0.01) {
            await updateDoc(doc(db, 'transactions', txDoc.id), {
              status: 'successful',
              updated_at: serverTimestamp(),
            });
            break;
          }
        }

        await addDoc(collection(db, 'notifications'), {
          user_id: withdrawal.user_id,
          title: '✅ Withdrawal Successful',
          message: `Your withdrawal of ${formatNaira(withdrawal.net_amount)} has been sent to your ${withdrawal.bank_name} account (••••${withdrawal.account_number.slice(-4)}).`,
          type: 'success',
          read: false,
          created_at: serverTimestamp(),
        });

        alert('✅ Marked as paid. User notified.');
        await loadAllData();
        setActionLoading(null);
        return;
      }

      // ============ APPROVE ============
      if (settings.paystackWithdrawalEnabled) {
        const bankCode = getBankCode(withdrawal.bank_name) || withdrawal.bank_code || '';
        if (!bankCode) {
          alert(`Bank code missing for ${withdrawal.bank_name}. Cannot process Paystack transfer.`);
          setActionLoading(null);
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/paystack/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountNumber: withdrawal.account_number,
            bankCode,
            accountName: withdrawal.account_name,
            amount: withdrawal.net_amount,
            withdrawalId: withdrawal.id,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          const fallbackMsg = settings.manualWithdrawalEnabled
            ? '\n\nTip: Use "Mark as Paid" after sending the money manually.'
            : '';
          alert('❌ Paystack transfer failed: ' + (result.error || 'Unknown error') + fallbackMsg);
          setActionLoading(null);
          return;
        }

        await updateDoc(doc(db, 'withdrawals', withdrawalId), {
          status: 'successful',
          payment_method: 'paystack',
          paystack_recipient_code: result.recipient_code,
          paystack_transfer_code: result.transfer_code,
          approved_at: serverTimestamp(),
          approved_by: admin?.phone || 'admin',
        });

        const txQuery = query(
          collection(db, 'transactions'),
          where('user_id', '==', withdrawal.user_id),
          where('type', '==', 'withdrawal'),
          where('status', '==', 'pending')
        );
        const txSnap = await getDocs(txQuery);
        for (const txDoc of txSnap.docs) {
          const data = txDoc.data();
          if (Math.abs((data.amount || 0) - withdrawal.amount) < 0.01) {
            await updateDoc(doc(db, 'transactions', txDoc.id), {
              status: 'successful',
              updated_at: serverTimestamp(),
            });
            break;
          }
        }

        await addDoc(collection(db, 'notifications'), {
          user_id: withdrawal.user_id,
          title: '✅ Withdrawal Successful',
          message: `Your withdrawal of ${formatNaira(withdrawal.net_amount)} has been sent to your ${withdrawal.bank_name} account (••••${withdrawal.account_number.slice(-4)}).`,
          type: 'success',
          read: false,
          created_at: serverTimestamp(),
        });

        alert('✅ Withdrawal approved and sent via Paystack!');
      } else {
        // Manual mode → mark as approved (awaiting manual send)
        await updateDoc(doc(db, 'withdrawals', withdrawalId), {
          status: 'approved',
          approved_at: serverTimestamp(),
          approved_by: admin?.phone || 'admin',
          payment_method: 'manual',
        });

        await addDoc(collection(db, 'notifications'), {
          user_id: withdrawal.user_id,
          title: '⏳ Withdrawal Approved',
          message: `Your withdrawal of ${formatNaira(withdrawal.net_amount)} has been approved and is being processed. You'll be notified once it's paid.`,
          type: 'info',
          read: false,
          created_at: serverTimestamp(),
        });

        alert(
          '✅ Withdrawal approved.\n\n' +
            'Now send ' +
            formatNaira(withdrawal.net_amount) +
            ' to:\n' +
            withdrawal.account_name +
            '\n' +
            withdrawal.bank_name +
            ' • ' +
            withdrawal.account_number +
            '\n\nThen click "Mark as Paid" to close it out.'
        );
      }

      await loadAllData();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      alert('Action failed. Please try again.');
    }
    setActionLoading(null);
  };

  // ============ DEPOSIT ACTIONS ============
  const handleDepositAction = async (depositId: string, action: 'approve' | 'reject') => {
  setActionLoading(depositId);
  try {
    const deposit = deposits.find((d) => d.id === depositId);
    if (!deposit) return;

    // Safety: Paystack deposits are auto-credited by the webhook. Don't double-credit.
    if (deposit.method === 'paystack') {
      alert('This is a Paystack deposit — credited automatically. No approval needed.');
      setActionLoading(null);
      return;
    }

    if (action === 'approve') {
      await runTransaction(db, async (transaction) => {
        const depositRef = doc(db, 'transactions', depositId);
        const userRef = doc(db, 'users', deposit.user_id);

        // Read the deposit doc INSIDE the transaction to prevent double-credit
        const freshDepositSnap = await transaction.get(depositRef);
        if (!freshDepositSnap.exists()) throw new Error('Deposit not found');

        const freshDeposit = freshDepositSnap.data();

        // ⚠️ Guard: if already credited, abort
        if (freshDeposit.credited === true || freshDeposit.status === 'successful') {
          throw new Error('ALREADY_CREDITED');
        }

        // ⭐ Pay 40% referral commission (once per referred user)
try {
  const referredRef = doc(db, 'users', deposit.user_id);
  const referredSnap = await getDoc(referredRef);
  const referred = referredSnap.data();
  const referrerCode = referred?.referred_by;

  if (referrerCode && !referred?.referral_commission_paid) {
    const q = query(collection(db, 'users'), where('referral_code', '==', referrerCode));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const referrerId = snap.docs[0].id;
      const referrerRef = doc(db, 'users', referrerId);
      const commission = deposit.amount * 0.4;

      await runTransaction(db, async (transaction) => {
        const freshReferred = await transaction.get(referredRef);
        if (freshReferred.data()?.referral_commission_paid) {
          throw new Error('ALREADY_PAID');
        }

        const freshReferrer = await transaction.get(referrerRef);
        const referrerData = freshReferrer.data();

        transaction.update(referrerRef, {
          wallet_balance: (referrerData?.wallet_balance || 0) + commission,
          portfolio_value: (referrerData?.portfolio_value || 0) + commission,
          total_referral_earnings: (referrerData?.total_referral_earnings || 0) + commission,
        });

        transaction.update(referredRef, {
          referral_commission_paid: true,
          referral_commission_amount: commission,
          referral_commission_paid_at: serverTimestamp(),
        });

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          user_id: referrerId,
          amount: commission,
          type: 'referral',
          description: '40% referral commission from a referred user deposit',
          status: 'successful',
          created_at: serverTimestamp(),
        });

        const notifRef = doc(collection(db, 'notifications'));
        transaction.set(notifRef, {
          user_id: referrerId,
          title: '💰 Referral Commission Earned',
          message: `You earned ₦${commission.toLocaleString()} (40%) from a referred user's deposit.`,
          type: 'referral',
          read: false,
          created_at: serverTimestamp(),
        });
      });

      console.log(`✅ Referral: ₦${commission} → ${referrerId}`);
    }
  }
} catch (refErr: any) {
  if (refErr?.message !== 'ALREADY_PAID') {
    console.warn('Referral payout failed (non-fatal):', refErr);
  }
}

        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');

        const userData = userSnap.data();

        // 1. Credit wallet
        transaction.update(userRef, {
          wallet_balance: (userData.wallet_balance || 0) + deposit.amount,
          portfolio_value: (userData.portfolio_value || 0) + deposit.amount,
        });

        // 2. Mark deposit as successful + credited
        transaction.update(depositRef, {
          status: 'successful',
          credited: true,
          approved_at: serverTimestamp(),
          approved_by: admin?.phone || 'admin',
        });

        // 3. Notification
        const notifRef = doc(collection(db, 'notifications'));
        transaction.set(notifRef, {
          user_id: deposit.user_id,
          title: '✅ Deposit Approved',
          message: `Your deposit of ${formatNaira(deposit.amount)} has been credited to your wallet.`,
          type: 'success',
          read: false,
          created_at: serverTimestamp(),
        });
      });

      alert('Deposit approved and wallet credited!');
    } else {
      // REJECT
      await updateDoc(doc(db, 'transactions', depositId), {
        status: 'failed',
        rejected_at: serverTimestamp(),
        rejected_by: admin?.phone || 'admin',
      });

      await addDoc(collection(db, 'notifications'), {
        user_id: deposit.user_id,
        title: '❌ Deposit Rejected',
        message: `Your deposit of ${formatNaira(deposit.amount)} was rejected. Please contact support.`,
        type: 'error',
        read: false,
        created_at: serverTimestamp(),
      });

      alert('Deposit rejected.');
    }

    await loadAllData();
  } catch (error: any) {
    if (error?.message === 'ALREADY_CREDITED') {
      alert('This deposit has already been credited.');
    } else {
      console.error('Error processing deposit:', error);
      alert('Action failed. Please try again.');
    }
  }
  setActionLoading(null);
};

  // ============ USER ACTIONS ============
  const handleSuspendUser = async (userId: string, suspend: boolean) => {
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        is_suspended: suspend,
        suspended_at: suspend ? serverTimestamp() : null,
      });

      await addDoc(collection(db, 'notifications'), {
        user_id: userId,
        title: suspend ? 'Account Suspended' : 'Account Reactivated',
        message: suspend
          ? 'Your account has been suspended. Please contact support.'
          : 'Your account has been reactivated. Welcome back!',
        type: suspend ? 'error' : 'success',
        read: false,
        created_at: serverTimestamp(),
      });

      await loadAllData();
      setSelectedUser(null);
    } catch (error) {
      console.error('Error suspending user:', error);
    }
    setActionLoading(null);
  };

  const handleAdjustBalance = async (userId: string, amount: number, operation: 'add' | 'subtract') => {
    setActionLoading(userId);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');

        const userData = userSnap.data();
        const currentBalance = userData.wallet_balance || 0;
        const newBalance = operation === 'add'
          ? currentBalance + amount
          : Math.max(0, currentBalance - amount);

        transaction.update(userRef, {
          wallet_balance: newBalance,
          portfolio_value: operation === 'add'
            ? (userData.portfolio_value || 0) + amount
            : Math.max(0, (userData.portfolio_value || 0) - amount),
        });

        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          user_id: userId,
          amount: amount,
          type: operation === 'add' ? 'deposit' : 'withdrawal',
          description: `Admin ${operation === 'add' ? 'credit' : 'debit'}`,
          status: 'successful',
          created_at: serverTimestamp(),
        });

        const notifRef = doc(collection(db, 'notifications'));
        transaction.set(notifRef, {
          user_id: userId,
          title: operation === 'add' ? 'Wallet Credited' : 'Wallet Debited',
          message: operation === 'add'
            ? `Your wallet has been credited with ${formatNaira(amount)} by an admin.`
            : `${formatNaira(amount)} has been debited from your wallet by an admin.`,
          type: operation === 'add' ? 'success' : 'warning',
          read: false,
          created_at: serverTimestamp(),
        });
      });
      await loadAllData();
      setSelectedUser(null);
    } catch (error) {
      console.error('Error adjusting balance:', error);
    }
    setActionLoading(null);
  };

  // ============ PLAN ACTIONS ============
  const handleSavePlan = async (planData: Omit<Plan, 'id'>) => {
    setActionLoading('plan-save');
    try {
      if (planModal?.mode === 'edit' && planModal.plan) {
        await updateDoc(doc(db, 'plans', planModal.plan.id), {
          ...planData,
          updated_at: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'plans'), {
          ...planData,
          created_at: serverTimestamp(),
        });
      }
      await loadAllData();
      setPlanModal(null);
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan');
    }
    setActionLoading(null);
  };

  const handleDeletePlan = async (plan: Plan) => {
    setActionLoading(plan.id);
    try {
      await deleteDoc(doc(db, 'plans', plan.id));
      await loadAllData();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan');
    }
    setActionLoading(null);
  };

  const handleTogglePlanLock = async (plan: Plan) => {
    setActionLoading(plan.id);
    try {
      await updateDoc(doc(db, 'plans', plan.id), {
        locked: !plan.locked,
      });
      await loadAllData();
    } catch (error) {
      console.error('Error toggling plan lock:', error);
    }
    setActionLoading(null);
  };

  // ============ NOTIFICATION ACTIONS ============
  const handleSendNotification = async (userId: string, title: string, message: string, type: string) => {
    setActionLoading('notify');
    try {
      await addDoc(collection(db, 'notifications'), {
        user_id: userId,
        title,
        message,
        type,
        read: false,
        created_at: serverTimestamp(),
        sent_by: admin?.phone || 'admin',
      });
      setNotifyModal(null);
      alert('Notification sent successfully!');
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Failed to send notification');
    }
    setActionLoading(null);
  };

  // ============ FILTERS ============
  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone?.includes(searchQuery) ||
    u.referral_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWithdrawals = withdrawals.filter(w => {
    const matchesSearch =
      w.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.userPhone?.includes(searchQuery) ||
      w.account_number?.includes(searchQuery);
    const matchesStatus =
      filterStatus === 'all' ||
      w.status === filterStatus ||
      (filterStatus === 'pending' && w.status === 'withdrawal_in_progress');
    return matchesSearch && matchesStatus;
  });

  const filteredDeposits = deposits.filter(d => {
    const matchesSearch =
      d.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.userPhone?.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || (d.status || 'approved') === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login', { replace: true });
  };

  if (!admin) return null;

  const navItems: { key: AdminTab; label: string; icon: any; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine, badge: stats.pendingWithdrawals },
    { key: 'deposits', label: 'Deposits', icon: ArrowDownToLine, badge: stats.pendingDeposits },
    { key: 'plans', label: 'Investment Plans', icon: Package },
    { key: 'giftcodes', label: 'Gift Codes', icon: Gift },
    { key: 'transactions', label: 'Transactions', icon: TrendingUp },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* SIDEBAR */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#0f0f16] border-r border-slate-800/50 z-40 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/10 border border-red-500/30 flex items-center justify-center">
              <Shield size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold">Admin Panel</p>
              <p className="text-[10px] text-slate-500">TerraVault Control</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setSidebarOpen(false);
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800/50 bg-[#0f0f16]">
          <div className="px-3 py-2 mb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Logged in as</p>
            <p className="text-xs text-slate-300 font-mono">{admin.phone}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={18} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN */}
      <div className="lg:ml-64">
        <header className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-lg border-b border-slate-800/50 px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden w-9 h-9 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-400"
              >
                <Menu size={18} />
              </button>
              <div>
                <h1 className="text-base font-bold capitalize">{activeTab}</h1>
                <p className="text-[10px] text-slate-500">
                  {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* {activeTab === 'settings' && <AdminSettings />} */}
              {activeTab === 'plans' && (
                <button
                  onClick={() => setPlanModal({ mode: 'create' })}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-semibold hover:from-red-500 hover:to-red-400 transition-all"
                >
                  <Plus size={14} /> New Plan
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-9 h-9 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        <main className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <StatCard label="Total Users" value={stats.totalUsers.toString()} icon={Users} color="sky" />
                    <StatCard label="Total Balance" value={formatNaira(stats.totalBalance)} icon={Wallet} color="emerald" />
                    <StatCard label="Total Withdrawn" value={formatNaira(stats.totalWithdrawn)} icon={ArrowUpFromLine} color="gold" />
                    <StatCard label="Pending Withdrawals" value={stats.pendingWithdrawals.toString()} icon={Clock} color="red" />
                    <StatCard label="Pending Deposits" value={stats.pendingDeposits.toString()} icon={ArrowDownToLine} color="amber" />
                    <StatCard label="Total Investments" value={stats.totalInvestments.toString()} icon={TrendingUp} color="violet" />
                  </div>

                  <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-amber-400" />
                        <h2 className="text-sm font-bold">Pending Withdrawals</h2>
                      </div>
                      <button onClick={() => setActiveTab('withdrawals')} className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1">
                        View all <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-800/30">
                      {withdrawals
                        .filter(w => w.status === 'pending' || w.status === 'withdrawal_in_progress')
                        .slice(0, 5)
                        .map((w) => (
                          <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{w.userName}</p>
                              <p className="text-[11px] text-slate-500">{w.bank_name} • {w.account_number}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-red-400">{formatNaira(w.amount)}</p>
                              <p className="text-[10px] text-slate-500">{formatTimeAgo(w.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      {withdrawals.filter(w => w.status === 'pending' || w.status === 'withdrawal_in_progress').length === 0 && (
                        <div className="px-5 py-8 text-center text-slate-500 text-sm">No pending withdrawals</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-sky-400" />
                        <h2 className="text-sm font-bold">Recent Users</h2>
                      </div>
                      <button onClick={() => setActiveTab('users')} className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1">
                        View all <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-800/30">
                      {users.slice(0, 5).map((u) => (
                        <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{u.full_name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{u.phone}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-emerald">{formatNaira(u.wallet_balance)}</p>
                            <p className="text-[10px] text-slate-500">{formatTimeAgo(u.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* USERS */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search by name, phone, or referral code..." />

                  <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-3 text-left font-semibold">User</th>
                            <th className="px-4 py-3 text-left font-semibold">Phone</th>
                            <th className="px-4 py-3 text-right font-semibold">Balance</th>
                            <th className="px-4 py-3 text-right font-semibold">Portfolio</th>
                            <th className="px-4 py-3 text-center font-semibold">Status</th>
                            <th className="px-4 py-3 text-center font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-slate-700/50 flex items-center justify-center text-xs font-bold">
                                    {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <p className="font-semibold">{u.full_name || 'Unknown'}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{u.referral_code}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-400 font-mono text-xs">{u.phone}</td>
                              <td className="px-4 py-3 text-right font-semibold text-emerald">{formatNaira(u.wallet_balance)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gold">{formatNaira(u.portfolio_value)}</td>
                              <td className="px-4 py-3 text-center">
                                {u.is_suspended ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold">
                                    <UserX size={10} /> Suspended
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald/15 text-emerald text-[10px] font-semibold">
                                    <UserCheck size={10} /> Active
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => setSelectedUser(u)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:border-red-500/40 transition-all"
                                >
                                  <Eye size={12} /> Manage
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredUsers.length === 0 && (
                      <div className="px-5 py-12 text-center text-slate-500 text-sm">No users found</div>
                    )}
                  </div>
                </div>
              )}

              {/* WITHDRAWALS */}
              {activeTab === 'withdrawals' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search by user, phone, or account..." />
                    <FilterTabs value={filterStatus} onChange={setFilterStatus} />
                  </div>

                  <div className="space-y-3">
                    {filteredWithdrawals.map((w) => (
                      <div key={w.id} className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{w.userName}</p>
                              <StatusBadge status={w.status} />
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono">{w.userPhone}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-red-400">{formatNaira(w.amount)}</p>
                            <p className="text-[10px] text-slate-500">{formatTimeAgo(w.created_at)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3 p-3 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Bank</p>
                            <p className="text-xs font-semibold">{w.bank_name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Account</p>
                            <p className="text-xs font-semibold font-mono">{w.account_number}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Account Name</p>
                            <p className="text-xs font-semibold">{w.account_name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Net Amount</p>
                            <p className="text-xs font-semibold text-emerald">{formatNaira(w.net_amount)}</p>
                          </div>
                        </div>

                        {(w.status === 'pending' || w.status === 'withdrawal_in_progress') && (
  <div className="flex gap-2">
    <button
      onClick={() => handleWithdrawalAction(w.id, 'reject')}
      disabled={actionLoading === w.id}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all disabled:opacity-50"
    >
      <XCircle size={14} /> Reject
    </button>
    <button
      onClick={() => handleWithdrawalAction(w.id, 'approve')}
      disabled={actionLoading === w.id}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald/15 border border-emerald/30 text-emerald text-xs font-semibold hover:bg-emerald/25 transition-all disabled:opacity-50"
    >
      <CheckCircle2 size={14} /> Approve
    </button>
  </div>
)}

{w.status === 'approved' && (
  <div className="flex gap-2">
    <button
      onClick={() => handleWithdrawalAction(w.id, 'reject')}
      disabled={actionLoading === w.id}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all disabled:opacity-50"
    >
      <XCircle size={14} /> Cancel & Refund
    </button>
    <button
      onClick={() => handleWithdrawalAction(w.id, 'mark_paid')}
      disabled={actionLoading === w.id}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-semibold hover:bg-sky-500/25 transition-all disabled:opacity-50"
    >
      <DollarSign size={14} /> Mark as Paid
    </button>
  </div>
)}
                      </div>
                    ))}
                    {filteredWithdrawals.length === 0 && (
                      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl px-5 py-12 text-center text-slate-500 text-sm">
                        No withdrawals found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DEPOSITS */}
              {activeTab === 'deposits' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search by user or phone..." />
                    <FilterTabs value={filterStatus} onChange={setFilterStatus} />
                  </div>

                  <div className="space-y-3">
                    {filteredDeposits.map((d) => (
                      <div key={d.id} className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{d.userName}</p>
                              <StatusBadge status={d.status || 'successful'} />
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono">{d.userPhone}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-emerald">{formatNaira(d.amount)}</p>
                            <p className="text-[10px] text-slate-500">{formatTimeAgo(d.created_at)}</p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 mb-3">{d.description}</p>

                        {d.method === 'paystack' ? (
                          <div className="flex items-center gap-2 text-[11px] text-emerald bg-emerald/10 border border-emerald/20 rounded-lg px-3 py-2">
                            <CheckCircle2 size={12} />
                            Auto-credited via Paystack — no approval needed
                          </div>
                        ) : d.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDepositAction(d.id, 'reject')}
                              disabled={actionLoading === d.id}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all disabled:opacity-50"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                            <button
                              onClick={() => handleDepositAction(d.id, 'approve')}
                              disabled={actionLoading === d.id}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald/15 border border-emerald/30 text-emerald text-xs font-semibold hover:bg-emerald/25 transition-all disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {filteredDeposits.length === 0 && (
                      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl px-5 py-12 text-center text-slate-500 text-sm">
                        No deposits found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PLANS */}
              {activeTab === 'plans' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      {plans.length} investment plan{plans.length !== 1 ? 's' : ''} • {plans.filter(p => !p.locked).length} active
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {plans.map((plan) => (
                      <div key={plan.id} className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800/50">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-sm">{plan.name}</h3>
                                {plan.locked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 text-[10px] font-semibold">
                                    <Lock size={9} /> Locked
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald/15 text-emerald text-[10px] font-semibold">
                                    <Unlock size={9} /> Active
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2">{plan.description}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 divide-x divide-slate-800/50">
                          <div className="p-3 text-center">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Cost</p>
                            <p className="text-xs font-bold text-white">{formatNaira(plan.cost)}</p>
                          </div>
                          <div className="p-3 text-center">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Daily</p>
                            <p className="text-xs font-bold text-emerald">{formatNaira(plan.daily_yield)}</p>
                          </div>
                          <div className="p-3 text-center">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Duration</p>
                            <p className="text-xs font-bold text-slate-300">{plan.duration_days}d</p>
                          </div>
                        </div>

                        <div className="p-4 border-t border-slate-800/50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] text-slate-500">Total Return</span>
                            <span className="text-sm font-bold text-gold">{formatNaira(plan.total_return)}</span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleTogglePlanLock(plan)}
                              disabled={actionLoading === plan.id}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                                plan.locked
                                  ? 'bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/25'
                                  : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {plan.locked ? <><Unlock size={12} /> Unlock</> : <><Lock size={12} /> Lock</>}
                            </button>
                            <button
                              onClick={() => setPlanModal({ mode: 'edit', plan })}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-semibold hover:bg-sky-500/25 transition-all"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(plan)}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {plans.length === 0 && (
                    <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl px-5 py-16 text-center">
                      <Package size={32} className="text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm mb-4">No investment plans yet</p>
                      <button
                        onClick={() => setPlanModal({ mode: 'create' })}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-semibold"
                      >
                        <Plus size={14} /> Create First Plan
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TRANSACTIONS */}
              {activeTab === 'transactions' && (
                <div className="space-y-4">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search transactions..." />

                  <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-3 text-left font-semibold">Type</th>
                            <th className="px-4 py-3 text-left font-semibold">Description</th>
                            <th className="px-4 py-3 text-right font-semibold">Amount</th>
                            <th className="px-4 py-3 text-right font-semibold">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {transactions
                            .filter(t =>
                              t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              t.type?.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .slice(0, 100)
                            .map((t) => (
                              <tr key={t.id} className="hover:bg-slate-800/20">
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-800/50 text-[10px] font-semibold uppercase tracking-wide">
                                    {t.type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-300 text-xs">{t.description}</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatNaira(t.amount)}</td>
                                <td className="px-4 py-3 text-right text-slate-500 text-xs">{formatTimeAgo(t.created_at)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {transactions.length === 0 && (
                      <div className="px-5 py-12 text-center text-slate-500 text-sm">No transactions found</div>
                    )}
                  </div>
                </div>
              )}

              {/* GIFT CODES */}
              {activeTab === 'giftcodes' && <AdminGiftCodes />}

              {/* NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                        <Bell size={18} className="text-violet-400" />
                      </div>
                      <div>
                        <h2 className="font-bold text-sm mb-1">Send Notification to User</h2>
                        <p className="text-xs text-slate-500">
                          Select a user below to send them a notification. Notifications appear in their dashboard.
                        </p>
                      </div>
                    </div>

                    <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search users..." />

                    <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                      {filteredUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-slate-700/50 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{u.full_name}</p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">{u.phone}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setNotifyModal({ user: u })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-semibold hover:bg-violet-500/25 transition-all flex-shrink-0"
                          >
                            <Send size={12} /> Send
                          </button>
                        </div>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="text-center py-8 text-slate-500 text-sm">No users found</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
               {/* SETTINGS */}
              {activeTab === 'settings' && <AdminSettings />}
            </>
          )}
        </main>
      </div>

      {/* MODALS */}
      {selectedUser && (
        <UserManagementModal
          user={selectedUser}
          transactions={transactions.filter(t => t.user_id === selectedUser.id)}
          onClose={() => setSelectedUser(null)}
          onSuspend={handleSuspendUser}
          onAdjustBalance={handleAdjustBalance}
          onNotify={() => {
            setNotifyModal({ user: selectedUser });
            setSelectedUser(null);
          }}
          loading={actionLoading === selectedUser.id}
        />
      )}

      {planModal && (
        <PlanModal
          mode={planModal.mode}
          plan={planModal.plan}
          onClose={() => setPlanModal(null)}
          onSave={handleSavePlan}
          loading={actionLoading === 'plan-save'}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          plan={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDeletePlan(deleteConfirm)}
          loading={actionLoading === deleteConfirm.id}
        />
      )}

      {notifyModal && (
        <NotificationModal
          user={notifyModal.user}
          onClose={() => setNotifyModal(null)}
          onSend={handleSendNotification}
          loading={actionLoading === 'notify'}
        />
      )}
    </div>
  );
}

// ============ SUB COMPONENTS ============

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    sky: 'from-sky-500/20 to-sky-500/5 border-sky-500/30 text-sky-400',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
    gold: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
    amber: 'from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-400',
  };
  const colors = colorMap[color] || colorMap.sky;
  const parts = colors.split(' ');

  return (
    <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${parts[0]} ${parts[1]} border ${parts[2]} flex items-center justify-center mb-3`}>
        <Icon size={16} className={parts[3]} />
      </div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0f0f16] border border-slate-800/50 rounded-xl px-4 py-2.5 pl-10 text-sm placeholder-slate-600 focus:outline-none focus:border-red-500/40 transition-all"
      />
    </div>
  );
}

function FilterTabs({ value, onChange }: { value: 'all' | 'pending' | 'approved' | 'rejected'; onChange: (v: any) => void }) {
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];
  return (
    <div className="flex gap-1 bg-[#0f0f16] border border-slate-800/50 rounded-xl p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === t.key ? 'bg-red-500/20 text-red-300' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    withdrawal_in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    approved: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    successful: 'bg-emerald/15 text-emerald border-emerald/30',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = {
    withdrawal_in_progress: 'In Progress',
    successful: 'Successful',
    failed: 'Failed',
    approved: 'Awaiting Manual Send',
  };
  const label = labels[status] || status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${styles[status] || styles.pending}`}>
      {label}
    </span>
  );
}

function UserManagementModal({
  user,
  transactions,
  onClose,
  onSuspend,
  onAdjustBalance,
  onNotify,
  loading,
}: {
  user: UserProfile;
  transactions: Transaction[];
  onClose: () => void;
  onSuspend: (userId: string, suspend: boolean) => void;
  onAdjustBalance: (userId: string, amount: number, operation: 'add' | 'subtract') => void;
  onNotify: () => void;
  loading: boolean;
}) {
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustOperation, setAdjustOperation] = useState<'add' | 'subtract'>('add');
  const [activeSection, setActiveSection] = useState<'manage' | 'history'>('manage');

  const handleAdjust = () => {
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) return;
    onAdjustBalance(user.id, amount, adjustOperation);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-slate-700/50 flex items-center justify-center font-bold">
              {user.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-bold">{user.full_name}</p>
              <p className="text-[11px] text-slate-500 font-mono">{user.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-slate-800/50">
          <button
            onClick={() => setActiveSection('manage')}
            className={`flex-1 py-3 text-xs font-semibold transition-all ${
              activeSection === 'manage'
                ? 'text-red-400 border-b-2 border-red-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Wallet size={14} /> Manage
            </div>
          </button>
          <button
            onClick={() => setActiveSection('history')}
            className={`flex-1 py-3 text-xs font-semibold transition-all ${
              activeSection === 'history'
                ? 'text-red-400 border-b-2 border-red-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <History size={14} /> History ({transactions.length})
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeSection === 'manage' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Wallet Balance</p>
                  <p className="text-sm font-bold text-emerald">{formatNaira(user.wallet_balance)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Portfolio Value</p>
                  <p className="text-sm font-bold text-gold">{formatNaira(user.portfolio_value)}</p>
                </div>
              </div>

              <button
                onClick={onNotify}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-semibold hover:bg-violet-500/25 transition-all"
              >
                <Send size={14} /> Send Notification
              </button>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Adjust Balance
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setAdjustOperation('add')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      adjustOperation === 'add'
                        ? 'bg-emerald/20 text-emerald border border-emerald/40'
                        : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                    }`}
                  >
                    + Credit
                  </button>
                  <button
                    onClick={() => setAdjustOperation('subtract')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      adjustOperation === 'subtract'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                    }`}
                  >
                    − Debit
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40"
                  />
                  <button
                    onClick={handleAdjust}
                    disabled={loading || !adjustAmount}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                      adjustOperation === 'add'
                        ? 'bg-emerald text-white hover:bg-emerald/90'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    {loading ? '...' : 'Apply'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Account Status
                </label>
                <button
                  onClick={() => onSuspend(user.id, !user.is_suspended)}
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${
                    user.is_suspended
                      ? 'bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/25'
                      : 'bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25'
                  }`}
                >
                  {user.is_suspended ? (
                    <><UserCheck size={14} /> Unsuspend Account</>
                  ) : (
                    <><Ban size={14} /> Suspend Account</>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'history' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <History size={32} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No transactions yet</p>
                </div>
              ) : (
                transactions.map((t) => {
                  const isCredit = ['deposit', 'check_in', 'welcome_bonus', 'referral', 'yield'].includes(t.type);
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800/50 text-[9px] font-semibold uppercase tracking-wide">
                            {t.type.replace('_', ' ')}
                          </span>
                          {t.status && <StatusBadge status={t.status} />}
                        </div>
                        <p className="text-xs text-slate-300 truncate">{t.description}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{formatTimeAgo(t.created_at)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${isCredit ? 'text-emerald' : 'text-red-400'}`}>
                          {isCredit ? '+' : '-'}{formatNaira(t.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanModal({
  mode,
  plan,
  onClose,
  onSave,
  loading,
}: {
  mode: 'create' | 'edit';
  plan?: Plan;
  onClose: () => void;
  onSave: (data: Omit<Plan, 'id'>) => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    cost: plan?.cost?.toString() || '',
    daily_yield: plan?.daily_yield?.toString() || '',
    duration_days: plan?.duration_days?.toString() || '',
    total_return: plan?.total_return?.toString() || '',
    locked: plan?.locked || false,
    sort_order: plan?.sort_order?.toString() || '1',
    description: plan?.description || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.cost || parseFloat(formData.cost) <= 0) newErrors.cost = 'Valid cost required';
    if (!formData.daily_yield || parseFloat(formData.daily_yield) <= 0) newErrors.daily_yield = 'Valid daily yield required';
    if (!formData.duration_days || parseInt(formData.duration_days) <= 0) newErrors.duration_days = 'Valid duration required';
    if (!formData.total_return || parseFloat(formData.total_return) <= 0) newErrors.total_return = 'Valid total return required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: formData.name.trim(),
      cost: parseFloat(formData.cost),
      daily_yield: parseFloat(formData.daily_yield),
      duration_days: parseInt(formData.duration_days),
      total_return: parseFloat(formData.total_return),
      locked: formData.locked,
      sort_order: parseInt(formData.sort_order) || 1,
      description: formData.description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/10 border border-red-500/30 flex items-center justify-center">
              <Package size={18} className="text-red-400" />
            </div>
            <div>
              <p className="font-bold">{mode === 'create' ? 'Create New Plan' : 'Edit Plan'}</p>
              <p className="text-[11px] text-slate-500">
                {mode === 'create' ? 'Add a new investment plan' : `Editing: ${plan?.name}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Field label="Plan Name" error={errors.name}>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Mowe Garden Estate"
              className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40"
            />
          </Field>

          <Field label="Description" error={errors.description}>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the investment plan"
              rows={2}
              className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost (₦)" error={errors.cost}>
              <input
                type="number"
                value={formData.cost}
                onChange={(e) => handleChange('cost', e.target.value)}
                placeholder="100000"
                className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40"
              />
            </Field>

            <Field label="Daily Yield (₦)" error={errors.daily_yield}>
              <input
                type="number"
                value={formData.daily_yield}
                onChange={(e) => handleChange('daily_yield', e.target.value)}
                placeholder="1000"
                className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40"
              />
            </Field>

            <Field label="Duration (days)" error={errors.duration_days}>
              <input
                type="number"
                value={formData.duration_days}
                onChange={(e) => handleChange('duration_days', e.target.value)}
                placeholder="30"
                className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40"
              />
            </Field>

            <Field label="Total Return (₦)" error={errors.total_return}>
              <input
                type="number"
                value={formData.total_return}
                onChange={(e) => handleChange('total_return', e.target.value)}
                placeholder="130000"
                className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40"
              />
            </Field>
          </div>

          <Field label="Sort Order">
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) => handleChange('sort_order', e.target.value)}
              placeholder="1"
              className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/40"
            />
          </Field>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
            <div>
              <p className="text-sm font-semibold">Lock this plan</p>
              <p className="text-[11px] text-slate-500">Locked plans show as "Coming Soon"</p>
            </div>
            <button
              onClick={() => handleChange('locked', !formData.locked)}
              className={`relative w-12 h-6 rounded-full transition-all ${
                formData.locked ? 'bg-gold' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                formData.locked ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800/50 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm font-semibold hover:bg-slate-700/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-semibold hover:from-red-500 hover:to-red-400 transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : mode === 'create' ? 'Create Plan' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function DeleteConfirmModal({
  plan,
  onClose,
  onConfirm,
  loading,
}: {
  plan: Plan;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0f0f16] border border-red-500/30 rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-red-400" />
          </div>
          <h2 className="text-base font-bold mb-2">Delete Plan?</h2>
          <p className="text-sm text-slate-400 mb-5">
            Are you sure you want to delete <span className="text-white font-semibold">{plan.name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm font-semibold hover:bg-slate-700/50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationModal({
  user,
  onClose,
  onSend,
  loading,
}: {
  user: UserProfile;
  onClose: () => void;
  onSend: (userId: string, title: string, message: string, type: string) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(true);

  const groupedTemplates = getTemplatesByCategory();

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = NOTIFICATION_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setTitle(template.title);
      setMessage(template.message);
      setType(template.type);
    }
  };

  const handleManualEdit = (field: 'title' | 'message', value: string) => {
    if (field === 'title') setTitle(value);
    if (field === 'message') setMessage(value);
    setSelectedTemplateId('');
  };

  const handleSend = () => {
    if (!title.trim() || !message.trim()) return;
    onSend(user.id, title.trim(), message.trim(), type);
  };

  const types = [
    { key: 'info', label: 'Info', color: 'sky' },
    { key: 'success', label: 'Success', color: 'emerald' },
    { key: 'warning', label: 'Warning', color: 'amber' },
    { key: 'error', label: 'Error', color: 'red' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f16] border border-slate-800/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center">
              <Bell size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="font-bold">Send Notification</p>
              <p className="text-[11px] text-slate-500">To: {user.full_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-violet-400" />
              <p className="text-xs font-bold text-violet-300 uppercase tracking-wide">
                Quick Templates
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Pick a template to auto-fill the title, message, and type.
            </p>

            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-violet-500/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 cursor-pointer"
            >
              <option value="">— Choose a template —</option>
              {Object.entries(groupedTemplates).map(([category, templates]) => (
                <optgroup key={category} label={category}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {selectedTemplateId && (
              <button
                onClick={() => {
                  setSelectedTemplateId('');
                  setTitle('');
                  setMessage('');
                  setType('info');
                }}
                className="mt-2 text-[11px] text-slate-400 hover:text-red-400 transition-colors"
              >
                Clear selection
              </button>
            )}
          </div>

          <Field label="Notification Type">
            <div className="grid grid-cols-4 gap-2">
              {types.map((t) => {
                const colorClasses: Record<string, string> = {
                  sky: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
                  emerald: 'bg-emerald/20 text-emerald border-emerald/40',
                  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
                  red: 'bg-red-500/20 text-red-400 border-red-500/40',
                };
                return (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all border ${
                      type === t.key
                        ? colorClasses[t.color]
                        : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={`Title (${title.length}/60)`}>
            <input
              type="text"
              value={title}
              onChange={(e) => handleManualEdit('title', e.target.value)}
              placeholder="Notification title"
              maxLength={60}
              className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
            />
          </Field>

          <Field label={`Message (${message.length}/300)`}>
            <textarea
              value={message}
              onChange={(e) => handleManualEdit('message', e.target.value)}
              placeholder="Notification message"
              rows={4}
              maxLength={300}
              className="w-full bg-[#0a0a0f] border border-slate-800/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40 resize-none"
            />
          </Field>

          {(title || message) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Preview
                </p>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  {showPreview ? 'Hide' : 'Show'}
                </button>
              </div>
              {showPreview && (
                <div className="p-4 rounded-xl bg-[#0a0a0f] border border-slate-800/50">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        type === 'success'
                          ? 'bg-emerald/20'
                          : type === 'warning'
                          ? 'bg-amber-500/20'
                          : type === 'error'
                          ? 'bg-red-500/20'
                          : 'bg-sky-500/20'
                      }`}
                    >
                      <Bell
                        size={14}
                        className={
                          type === 'success'
                            ? 'text-emerald'
                            : type === 'warning'
                            ? 'text-amber-400'
                            : type === 'error'
                            ? 'text-red-400'
                            : 'text-sky-400'
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5">
                        {title || 'Notification title'}
                      </p>
                      <p className="text-xs text-slate-400 break-words">
                        {message || 'Notification message will appear here'}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1">just now</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800/50 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 text-sm font-semibold hover:bg-slate-700/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !title.trim() || !message.trim()}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-semibold hover:from-violet-500 hover:to-violet-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              'Sending...'
            ) : (
              <>
                <Send size={14} /> Send Notification
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}