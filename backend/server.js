// backend/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';
const MIN_DEPOSIT = 5000;

// ================================================
// ⭐ TELEGRAM NOTIFICATIONS
// ================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function notifyTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[telegram] Skipped — token or chat ID missing');
    return;
  }
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }
    );
    console.log('[telegram] ✅ Sent');
  } catch (err) {
    console.warn(
      '[telegram] Failed:',
      err.response?.data?.description || err.message
    );
  }
}

// ============ 1. INITIALIZE PAYSTACK DEPOSIT ============
app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const { email, amount, userId } = req.body;

    if (!amount || amount < MIN_DEPOSIT) {
      return res.status(400).json({
        success: false,
        error: `Minimum deposit is ₦${MIN_DEPOSIT.toLocaleString()}`,
      });
    }

    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: amount * 100,
        metadata: { userId },
        callback_url: `${process.env.FRONTEND_URL}/deposit-callback`,
        channels: ['bank_transfer'],
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      authorization_url: response.data.data.authorization_url,
      reference: response.data.data.reference,
    });
  } catch (error) {
    console.error('Paystack init error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to initialize payment' });
  }
});

// ============ 2. VERIFY PAYSTACK PAYMENT ============
app.get('/api/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    if (response.data.data.status === 'success') {
      const { metadata, amount } = response.data.data;
      const nairaAmount = amount / 100;
      res.json({ success: true, amount: nairaAmount, userId: metadata.userId, reference });
    } else {
      res.json({ success: false, message: 'Payment not successful' });
    }
  } catch (error) {
    console.error('Verify error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// ============ 3. PAYSTACK WEBHOOK ============
app.post('/api/paystack/webhook', async (req, res) => {
  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.sendStatus(401);
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const { metadata, amount, reference } = event.data;
      const nairaAmount = amount / 100;
      console.log(`✅ Payment received: ₦${nairaAmount} from user ${metadata.userId} (ref: ${reference})`);

      await notifyTelegram(
        [
          `💰 <b>Deposit Received (Webhook)</b>`,
          ``,
          `<b>User ID:</b> <code>${metadata.userId || 'Unknown'}</code>`,
          `<b>Amount:</b> ₦${nairaAmount.toLocaleString()}`,
          `<b>Ref:</b> <code>${reference}</code>`,
          ``,
          `<i>${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</i>`,
        ].join('\n')
      );
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// ============ 4. WITHDRAWAL: CREATE RECIPIENT & TRANSFER ============
app.post('/api/paystack/withdraw', async (req, res) => {
  try {
    const { accountNumber, bankCode, accountName, amount, withdrawalId } = req.body;

    const recipientResponse = await axios.post(
      `${PAYSTACK_BASE}/transferrecipient`,
      {
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const recipientCode = recipientResponse.data.data.recipient_code;

    const transferResponse = await axios.post(
      `${PAYSTACK_BASE}/transfer`,
      {
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reason: `Withdrawal ${withdrawalId}`,
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    res.json({
      success: true,
      recipient_code: recipientCode,
      transfer_code: transferResponse.data.data.transfer_code,
      status: transferResponse.data.data.status,
    });
  } catch (error) {
    console.error('Withdraw error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data?.message || 'Transfer failed' });
  }
});

// ============ 5. GET BANKS LIST ============
app.get('/api/paystack/banks', async (req, res) => {
  try {
    const response = await axios.get(`${PAYSTACK_BASE}/bank?country=nigeria`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    res.json({ success: true, banks: response.data.data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch banks' });
  }
});

// ============ 6. VERIFY ACCOUNT NUMBER ============
app.get('/api/paystack/verify-account', async (req, res) => {
  try {
    const { account_number, bank_code } = req.query;
    const response = await axios.get(
      `${PAYSTACK_BASE}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    res.json({ success: true, account_name: response.data.data.account_name });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Could not resolve account' });
  }
});

// ================================================
// ⭐ TELEGRAM NOTIFY ENDPOINTS
// ================================================

app.post('/api/telegram/deposit', async (req, res) => {
  try {
    const { userName, userPhone, amount, reference, method } = req.body;

    const text = [
      `💰 <b>New Deposit (${method === 'paystack' ? 'Paystack' : 'Manual'})</b>`,
      ``,
      `<b>User:</b> ${userName || 'Unknown'}`,
      `<b>Phone:</b> ${userPhone || 'N/A'}`,
      `<b>Amount:</b> ₦${Number(amount || 0).toLocaleString()}`,
      reference ? `<b>Ref:</b> <code>${reference}</code>` : '',
      ``,
      `<i>${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</i>`,
    ]
      .filter(Boolean)
      .join('\n');

    await notifyTelegram(text);
    res.json({ success: true });
  } catch (err) {
    console.error('[telegram/deposit]', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/telegram/withdraw', async (req, res) => {
  try {
    const {
      userName,
      userPhone,
      amount,
      netAmount,
      bankName,
      accountNumber,
      accountName,
    } = req.body;

    const text = [
      `🔔 <b>Withdrawal Request</b>`,
      ``,
      `<b>User:</b> ${userName || 'Unknown'}`,
      `<b>Phone:</b> ${userPhone || 'N/A'}`,
      `<b>Amount:</b> ₦${Number(amount || 0).toLocaleString()}`,
      `<b>Net:</b> ₦${Number(netAmount || 0).toLocaleString()}`,
      `<b>Bank:</b> ${bankName || 'N/A'}`,
      `<b>Account:</b> <code>${accountNumber || 'N/A'}</code>`,
      `<b>Name:</b> ${accountName || 'N/A'}`,
      ``,
      `<i>${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</i>`,
    ]
      .filter(Boolean)
      .join('\n');

    await notifyTelegram(text);
    res.json({ success: true });
  } catch (err) {
    console.error('[telegram/withdraw]', err);
    res.status(500).json({ success: false });
  }
});

app.get('/api/telegram/test', async (req, res) => {
  await notifyTelegram(
    `✅ <b>Telegram Integration Test</b>\n\nYour backend is connected to Telegram successfully.\n\n<i>${new Date().toISOString()}</i>`
  );
  res.json({ success: true, message: 'Check your Telegram' });
});

// ================================================
// ⭐ SERVE FRONTEND (single link for everything)
// ================================================
const frontendPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendPath));

// SPA fallback — any non-API route serves index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Use PORT env var (Render sets this automatically) or default 4000
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));