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
    // 1. Save to Firestore
    initAdmin();
    const db = admin.firestore();
    await db.collection('email_leads').doc(normalized).set({
      email: normalized,
      source: 'landing_page',
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. Add to Kit
    const kitRes = await fetch(
      `https://api.kit.com/v4/forms/${process.env.KIT_FORM_ID}/subscribers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kit-Api-Key': process.env.KIT_API_KEY,
        },
        body: JSON.stringify({ email_address: normalized }),
      }
    );
    const kitData = await kitRes.json();
    if (!kitRes.ok) {
      console.error('Kit API error:', JSON.stringify(kitData));
    } else {
      console.log('Kit subscriber added:', normalized);
    }

    res.json({ success: true, kitStatus: kitRes.status, kitData });
  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
