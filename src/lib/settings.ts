// src/lib/settings.ts
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface PlatformSettings {
  // Deposit mode
  paystackEnabled: boolean;
  manualDepositEnabled: boolean;

  // Manual deposit bank details (shown to users)
  manualBankName: string;
  manualBankAccountNumber: string;
  manualBankAccountName: string;

  // Withdrawal mode
  paystackWithdrawalEnabled: boolean;   // turn ON after CAC upgrade
  manualWithdrawalEnabled: boolean;     // turn OFF after CAC upgrade

  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  paystackEnabled: true,
  manualDepositEnabled: false,
  manualBankName: '',
  manualBankAccountNumber: '',
  manualBankAccountName: '',
  paystackWithdrawalEnabled: false,  // OFF until CAC upgrade
  manualWithdrawalEnabled: true,      // ON by default
};

const SETTINGS_DOC = doc(db, 'settings', 'platform');

/**
 * Fetch settings once
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const snap = await getDoc(SETTINGS_DOC);
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...(snap.data() as PlatformSettings) };
    }
    // Seed defaults on first read
    await setDoc(SETTINGS_DOC, { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update settings (admin only, enforced by Firestore rules)
 */
export async function updatePlatformSettings(
  patch: Partial<PlatformSettings>,
  adminPhone?: string
): Promise<void> {
  await setDoc(
    SETTINGS_DOC,
    {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: adminPhone || 'admin',
    },
    { merge: true }
  );
}

/**
 * Subscribe to settings changes (real-time)
 */
export function subscribeToSettings(
  callback: (settings: PlatformSettings) => void
): () => void {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...(snap.data() as PlatformSettings) });
    } else {
      callback(DEFAULT_SETTINGS);
    }
  });
}