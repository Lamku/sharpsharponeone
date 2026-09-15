// src/lib/paystack.ts

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface InitializePaymentResponse {
  success: boolean;
  authorization_url?: string;
  reference?: string;
  error?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  amount?: number;
  userId?: string;
  reference?: string;
  message?: string;
}

/**
 * Initialize a Paystack payment — returns a checkout URL to redirect the user to.
 */
export async function initializePayment(params: {
  email: string;
  amount: number;
  userId: string;
}): Promise<InitializePaymentResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/paystack/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (error) {
    console.error('initializePayment error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Verify a Paystack payment by reference (called on the callback page).
 */
export async function verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/paystack/verify/${reference}`);
    return await res.json();
  } catch (error) {
    console.error('verifyPayment error:', error);
    return { success: false, message: 'Verification failed' };
  }
}

/**
 * Trigger Paystack transfer (called from admin when approving a withdrawal).
 */
export async function processWithdrawal(params: {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amount: number;
  withdrawalId: string;
}) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/paystack/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (error) {
    console.error('processWithdrawal error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Verify a Nigerian bank account number.
 */
export async function verifyAccount(accountNumber: string, bankCode: string) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/paystack/verify-account?account_number=${accountNumber}&bank_code=${bankCode}`
    );
    return await res.json();
  } catch (error) {
    console.error('verifyAccount error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Nigerian bank codes (for Paystack API)
 */
export const BANK_CODES: Record<string, string> = {
  'OPay': '999992',
  'Moniepoint Microfinance Bank': '50515',
  'Access Bank': '044',
  'Zenith Bank': '057',
  'Guaranty Trust Bank (GTBank)': '058',
  'First Bank of Nigeria': '011',
  'United Bank for Africa (UBA)': '033',
  'Kuda Bank': '50211',
  'Palmpay': '999991',
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
};

export function getBankCode(bankName: string): string {
  return BANK_CODES[bankName] || '';
}