// src/lib/telegram.ts

// In production, BACKEND_URL is empty so requests go to the same domain
// (e.g. https://sharpsharponeone.onrender.com/api/telegram/deposit).
// In local dev, VITE_BACKEND_URL=http://localhost:4000 is set in .env.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export async function notifyDeposit(params: {
  userName: string;
  userPhone: string;
  amount: number;
  reference?: string;
  method: 'paystack' | 'manual';
}) {
  try {
    await fetch(`${BACKEND_URL}/api/telegram/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn('[telegram] deposit notify failed:', err);
  }
}

export async function notifyWithdrawal(params: {
  userName: string;
  userPhone: string;
  amount: number;
  netAmount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  try {
    await fetch(`${BACKEND_URL}/api/telegram/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn('[telegram] withdraw notify failed:', err);
  }
}