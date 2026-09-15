import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { signInAnonymously, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';

const ADMIN_PHONE = '09158409616';
const ADMIN_PASSWORD = 'Kingsley280';

interface AdminUser {
  phone: string;
  role: 'admin';
  loginTime: number;
  uid?: string;
}

type AdminAuthContextType = {
  admin: AdminUser | null;
  loading: boolean;
  adminLogin: (phone: string, password: string) => Promise<{ error: string | null }>;
  adminLogout: () => Promise<void>;
  isAdmin: boolean;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);
const ADMIN_SESSION_KEY = 'terravault_admin_session';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(false);

  // On mount: if admin session exists, ensure Firebase auth is restored
  useEffect(() => {
    const bootstrap = async () => {
      const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!stored) return;

      console.log('🔄 Restoring admin session from storage...');

      // Check current Firebase state
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('✅ Firebase already signed in:', currentUser.uid);
        try {
          const parsed = JSON.parse(stored) as AdminUser;
          setAdmin({ ...parsed, uid: currentUser.uid });
        } catch {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
        }
        return;
      }

      // No Firebase user — sign in anonymously
      console.log('⚠️ No Firebase user. Signing in anonymously...');
      try {
        const result = await signInAnonymously(auth);
        console.log('✅ Anonymous sign-in restored. UID:', result.user.uid);

        const parsed = JSON.parse(stored) as AdminUser;
        const restoredAdmin = { ...parsed, uid: result.user.uid };
        setAdmin(restoredAdmin);
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(restoredAdmin));
      } catch (error: any) {
        console.error('❌ Failed to restore Firebase session:', error);
        // Clear invalid session so user can login again
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAdmin(null);
      }
    };

    bootstrap();
  }, []);

  const adminLogin = useCallback(async (phone: string, password: string) => {
    console.log('═══════════════════════════════');
    console.log('🔐 ADMIN LOGIN');
    console.log('═══════════════════════════════');
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const normalizedPhone = phone.replace(/[\s\-()]/g, '');
    console.log('📱 Phone:', normalizedPhone);

    const isValidPhone =
      normalizedPhone === ADMIN_PHONE ||
      normalizedPhone === '+2349158409616' ||
      normalizedPhone === '2349158409616' ||
      normalizedPhone === '09158409616';

    if (!isValidPhone) {
      console.log('❌ Invalid phone');
      setLoading(false);
      return { error: 'Access denied. Invalid admin credentials.' };
    }

    if (password !== ADMIN_PASSWORD) {
      console.log('❌ Invalid password');
      setLoading(false);
      return { error: 'Access denied. Invalid admin credentials.' };
    }

    console.log('✅ Credentials valid. Signing in anonymously with Firebase...');

    // CRITICAL: Sign in with Firebase FIRST
    let firebaseUid: string;
    try {
      // Clear any existing auth state
      if (auth.currentUser) {
        console.log('⚠️ Signing out existing user first...');
        await firebaseSignOut(auth);
      }

      const result = await signInAnonymously(auth);
      firebaseUid = result.user.uid;
      console.log('✅✅✅ ANONYMOUS SIGN-IN SUCCESS!');
      console.log('🆔 Firebase UID:', firebaseUid);
      console.log('🔒 Is Anonymous:', result.user.isAnonymous);
    } catch (error: any) {
      console.error('❌❌❌ ANONYMOUS SIGN-IN FAILED!');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      setLoading(false);

      let errorMessage = 'Failed to authenticate with Firebase. ';
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage += 'Anonymous Auth is not enabled in Firebase Console.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage += 'Network error. Check your internet connection.';
      } else if (error.code === 'auth/admin-restricted-operation') {
        errorMessage += 'Anonymous Auth is disabled by Firebase admin.';
      } else {
        errorMessage += `Error: ${error.code || error.message}`;
      }

      return { error: errorMessage };
    }

    // Only save admin session AFTER successful Firebase sign-in
    const adminUser: AdminUser = {
      phone: normalizedPhone,
      role: 'admin',
      loginTime: Date.now(),
      uid: firebaseUid,
    };

    setAdmin(adminUser);
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminUser));
    setLoading(false);
    console.log('🎉 Admin login complete with UID:', firebaseUid);
    console.log('═══════════════════════════════');
    return { error: null };
  }, []);

  const adminLogout = useCallback(async () => {
    console.log('👋 Admin logging out...');
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
    setAdmin(null);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        adminLogin,
        adminLogout,
        isAdmin: !!admin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}