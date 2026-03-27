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
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(token);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { code } = body;

    if (!code) return res.status(400).json({ error: 'No code provided' });

    const validCode = process.env.ACCESS_CODE;
    if (!validCode) return res.status(500).json({ error: 'Access codes not configured' });

    if (code.trim().toUpperCase() !== validCode.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Invalid access code' });
    }

    await admin.firestore().doc(`users/${decoded.uid}`).set(
      { plan: 'premium', accessCode: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('redeem-code error:', err);
    res.status(500).json({ error: err.message });
  }
};
