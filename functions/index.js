// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * ⏰ Runs every hour on Google's servers.
 * Credits daily yields to users whose investments are due (24h+ since last credit).
 * This runs even when users are offline — nobody needs to open the app.
 */
exports.accrueInvestmentYields = functions
  .pubsub.schedule('every 1 hours')
  .timeZone('Africa/Lagos')
  .onRun(async () => {
    const now = Date.now();
    console.log(`[accrue] Running at ${new Date(now).toISOString()}`);

    const investmentsSnap = await db
      .collection('investments')
      .where('active', '==', true)
      .get();

    if (investmentsSnap.empty) {
      console.log('[accrue] No active investments');
      return null;
    }

    // Group yields by user so we do one wallet update per user
    const userYields = {};
    const investmentUpdates = [];

    for (const docSnap of investmentsSnap.docs) {
      const inv = docSnap.data();

      const lastYield = inv.last_yield_date?.toDate?.() || new Date(0);
      const elapsedMs = now - lastYield.getTime();
      const daysElapsed = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

      if (daysElapsed < 1) continue;

      const durationDays = inv.duration_days || 0;
      const dailyYield = inv.daily_yield || 0;
      const totalReturn = inv.total_return || dailyYield * durationDays;
      const accruedSoFar = inv.accrued_yield || 0;

      const remainingToEarn = Math.max(0, totalReturn - accruedSoFar);

      let yieldToCredit = dailyYield * daysElapsed;
      if (yieldToCredit > remainingToEarn) {
        yieldToCredit = remainingToEarn;
      }

      if (yieldToCredit <= 0) {
        // Investment has paid out fully — mark inactive
        investmentUpdates.push({
          ref: docSnap.ref,
          data: { active: false },
        });
        continue;
      }

      const newAccrued = accruedSoFar + yieldToCredit;
      const isCompleted = newAccrued >= totalReturn;

      investmentUpdates.push({
        ref: docSnap.ref,
        data: {
          last_yield_date: admin.firestore.Timestamp.fromDate(new Date()),
          accrued_yield: newAccrued,
          active: !isCompleted,
        },
      });

      if (!userYields[inv.user_id]) userYields[inv.user_id] = 0;
      userYields[inv.user_id] += yieldToCredit;
    }

    if (investmentUpdates.length === 0 && Object.keys(userYields).length === 0) {
      console.log('[accrue] Nothing to do');
      return null;
    }

    // Batch investment updates in chunks of 400 (Firestore limit is 500)
    const chunks = [];
    for (let i = 0; i < investmentUpdates.length; i += 400) {
      chunks.push(investmentUpdates.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      for (const upd of chunk) {
        batch.update(upd.ref, upd.data);
      }
      await batch.commit();
    }

    // Credit users in batched writes
    const userEntries = Object.entries(userYields);
    for (let i = 0; i < userEntries.length; i += 400) {
      const slice = userEntries.slice(i, i + 400);
      const batch = db.batch();

      for (const [userId, amount] of slice) {
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
          wallet_balance: admin.firestore.FieldValue.increment(amount),
          portfolio_value: admin.firestore.FieldValue.increment(amount),
        });

        const txRef = db.collection('transactions').doc();
        batch.set(txRef, {
          user_id: userId,
          amount,
          type: 'yield',
          description: 'Daily investment yield',
          status: 'successful',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
    }

    console.log(
      `[accrue] ✅ Credited ${userEntries.length} users, updated ${investmentUpdates.length} investments`
    );
    return null;
  });

/**
 * 🧪 Manual test trigger — call this URL to run accrual immediately
 * DELETE THIS before going to production, or keep it secured with the secret.
 */
exports.testAccrueNow = functions.https.onRequest(async (req, res) => {
  // Protect with a query secret
  if (req.query.secret !== 'sharpsharpone-test-2026') {
    res.status(403).send('Forbidden');
    return;
  }

  try {
    // Re-trigger the same logic
    const now = Date.now();
    const investmentsSnap = await db
      .collection('investments')
      .where('active', '==', true)
      .get();

    if (investmentsSnap.empty) {
      res.json({ success: true, message: 'No active investments' });
      return;
    }

    const userYields = {};
    const investmentUpdates = [];

    for (const docSnap of investmentsSnap.docs) {
      const inv = docSnap.data();
      const lastYield = inv.last_yield_date?.toDate?.() || new Date(0);
      const daysElapsed = Math.floor((now - lastYield.getTime()) / (24 * 60 * 60 * 1000));
      if (daysElapsed < 1) continue;

      const durationDays = inv.duration_days || 0;
      const dailyYield = inv.daily_yield || 0;
      const totalReturn = inv.total_return || dailyYield * durationDays;
      const accruedSoFar = inv.accrued_yield || 0;
      const remainingToEarn = Math.max(0, totalReturn - accruedSoFar);

      let yieldToCredit = dailyYield * daysElapsed;
      if (yieldToCredit > remainingToEarn) yieldToCredit = remainingToEarn;
      if (yieldToCredit <= 0) continue;

      const newAccrued = accruedSoFar + yieldToCredit;
      const isCompleted = newAccrued >= totalReturn;

      investmentUpdates.push({
        ref: docSnap.ref,
        data: {
          last_yield_date: admin.firestore.Timestamp.fromDate(new Date()),
          accrued_yield: newAccrued,
          active: !isCompleted,
        },
      });

      if (!userYields[inv.user_id]) userYields[inv.user_id] = 0;
      userYields[inv.user_id] += yieldToCredit;
    }

    const batch = db.batch();
    for (const upd of investmentUpdates) {
      batch.update(upd.ref, upd.data);
    }
    for (const [userId, amount] of Object.entries(userYields)) {
      batch.update(db.collection('users').doc(userId), {
        wallet_balance: admin.firestore.FieldValue.increment(amount),
        portfolio_value: admin.firestore.FieldValue.increment(amount),
      });
      const txRef = db.collection('transactions').doc();
      batch.set(txRef, {
        user_id: userId,
        amount,
        type: 'yield',
        description: 'Daily investment yield',
        status: 'successful',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Credited ${Object.keys(userYields).length} users, updated ${investmentUpdates.length} investments`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});