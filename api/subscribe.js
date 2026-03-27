const admin = require('firebase-admin');

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      ),
    });
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const normalized = email.toLowerCase().trim();

  try {
    initAdmin();
    const db = admin.firestore();
    // Doc ID = email so re-submits are silent no-ops
    await db.collection('email_leads').doc(normalized).set({
      email: normalized,
      source: 'landing_page',
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
