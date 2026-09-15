import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  auth,
  db
} from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

/**
 * Firebase Auth requires an email address. Since TerraVault is phone-only,
 * we synthesize a deterministic email from the phone number.
 */
const PHONE_DOMAIN = 'terravault.app';

export function phoneToEmail(phone: string): string {
  return `${phone}@${PHONE_DOMAIN}`;
}

/** Normalize a Nigerian phone number to +234XXXXXXXXXX format. */
export function normalizePhone(input: string): string {
  let p = input.replace(/[\s\-()]/g, '');
  if (p.startsWith('+234')) return p;
  if (p.startsWith('234')) return `+${p}`;
  if (p.startsWith('0')) return `+234${p.slice(1)}`;
  if (p.startsWith('7') || p.startsWith('8') || p.startsWith('9')) return `+234${p}`;
  return p;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  wallet_balance: number;
  portfolio_value: number;
  last_check_in: any;
  referral_code: string;
  referred_by: string | null;
  referral_commission_paid: boolean;      // ⭐ NEW
  total_referral_earnings: number;        // ⭐ NEW
  welcome_bonus_claimed: boolean;
  created_at: any;
  updated_at: any;
  last_withdrawal_at?: any;
}

type AuthContextType = {
  user: User | null;
  session: { user: User } | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: {
    password: string;
    fullName: string;
    phone: string;
    referralCode?: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (phone: string) => Promise<{ error: string | null }>;
  checkUserExists: (phone: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          id: docSnap.id,
          full_name: data.full_name || '',
          phone: data.phone || '',
          wallet_balance: data.wallet_balance || 0,
          portfolio_value: data.portfolio_value || 0,
          last_check_in: data.last_check_in || null,
          referral_code: data.referral_code || '',
          referred_by: data.referred_by || null,
          referral_commission_paid: data.referral_commission_paid || false,
          total_referral_earnings: data.total_referral_earnings || 0,
          welcome_bonus_claimed: data.welcome_bonus_claimed || false,
          created_at: data.created_at || null,
          updated_at: data.updated_at || null,
          last_withdrawal_at: data.last_withdrawal_at || null,
        });
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Profile load error:', error);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!mounted) return;

      setUser(currentUser);
      setSession(currentUser ? { user: currentUser } : null);

      if (currentUser) {
        await loadProfile(currentUser.uid);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadProfile]);

  const checkUserExists = useCallback(async (phone: string): Promise<boolean> => {
    try {
      const normalized = normalizePhone(phone);
      const email = phoneToEmail(normalized);
      const methods = await fetchSignInMethodsForEmail(auth, email);
      return methods.length > 0;
    } catch (error) {
      console.error('Error checking user:', error);
      return false;
    }
  }, []);

  const signIn = useCallback(async (phone: string, password: string) => {
    try {
      const normalized = normalizePhone(phone);
      const email = phoneToEmail(normalized);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const currentUser = userCredential.user;

      await loadProfile(currentUser.uid);
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);

      let errorMessage = 'Invalid phone number or password. Please try again.';

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this phone number. Please sign up.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid phone number format. Please check and try again.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = error.message || 'Login failed. Please try again.';
      }

      return { error: errorMessage };
    }
  }, [loadProfile]);

  const signUp = useCallback(
    async (params: {
      password: string;
      fullName: string;
      phone: string;
      referralCode?: string;
    }) => {
      try {
        const normalized = normalizePhone(params.phone);
        const email = phoneToEmail(normalized);

        // Check if user already exists
        const exists = await checkUserExists(params.phone);
        if (exists) {
          return { error: 'An account with this phone number already exists. Please sign in.' };
        }

        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, params.password);
        const user = userCredential.user;

        // Generate referral code for the new user
        const referralCode = `TV${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // ⭐ Validate the incoming referral code (if provided)
        let validReferrerCode: string | null = null;
        if (params.referralCode && params.referralCode.trim()) {
          const incoming = params.referralCode.trim().toUpperCase();
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('referral_code', '==', incoming));
          const snap = await getDocs(q);
          if (!snap.empty) {
            validReferrerCode = incoming;
          }
        }

        // Create user profile in Firestore
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', user.uid);

          const userSnap = await transaction.get(userRef);
          if (userSnap.exists()) {
            throw new Error('User already exists');
          }

          const welcomeBonus = 1500;

          transaction.set(userRef, {
            id: user.uid,
            full_name: params.fullName,
            phone: normalized,
            wallet_balance: welcomeBonus,
            portfolio_value: welcomeBonus,
            last_check_in: null,
            referral_code: referralCode,
            referred_by: validReferrerCode,           // ⭐ store the CODE (not ID)
            referral_commission_paid: false,          // ⭐ not paid yet
            total_referral_earnings: 0,               // ⭐ default
            welcome_bonus_claimed: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });

          // Welcome bonus transaction
          const transactionRef = doc(collection(db, 'transactions'));
          transaction.set(transactionRef, {
            user_id: user.uid,
            amount: welcomeBonus,
            type: 'welcome_bonus',
            description: 'Welcome bonus',
            status: 'successful',
            created_at: serverTimestamp()
          });
        });

        await loadProfile(user.uid);
        return { error: null };
      } catch (error: any) {
        console.error('Sign up error:', error);

        let errorMessage = 'Failed to create account. Please try again.';

        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'An account with this phone number already exists. Please sign in.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid phone number format. Please check and try again.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection.';
            break;
          default:
            errorMessage = error.message || 'Failed to create account. Please try again.';
        }

        return { error: errorMessage };
      }
    },
    [loadProfile, checkUserExists]
  );

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.uid);
    }
  }, [user, loadProfile]);

  const resetPassword = useCallback(async (phone: string) => {
    try {
      const normalized = normalizePhone(phone);
      const email = phoneToEmail(normalized);
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (error: any) {
      console.error('Reset password error:', error);
      return { error: error.message || 'Failed to send reset email' };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        resetPassword,
        checkUserExists
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}