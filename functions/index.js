const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

exports.resetAllBalances = functions.https.onRequest(async (req, res) => {
  if (req.query.secret !== 'sharpsharpone-reset-2026') {
    return res.status(403).send('Forbidden');
  }

  try {
    const usersSnap = await db.collection('users').get();

    if (usersSnap.empty) {
      return res.json({ success: true, usersReset: 0, message: 'No users found' });
    }

    const chunks = [];
    const docs = usersSnap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      chunks.push(docs.slice(i, i + 400));
    }

    let totalReset = 0;
    for (const chunk of chunks) {
      const batch = db.batch();
      for (const d of chunk) {
        batch.update(d.ref, {
          wallet_balance: 0,
          portfolio_value: 0,
        });
      }
      await batch.commit();
      totalReset += chunk.length;
    }

    res.json({ success: true, usersReset: totalReset });
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
