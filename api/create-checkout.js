const stripe = require('stripe')((process.env.STRIPE_SECRET_KEY || '').trim());
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
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(token);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: (process.env.STRIPE_PRICE_ID || '').trim(), quantity: 1 }],
      success_url: `${(process.env.SITE_URL || '').trim()}?payment=success`,
      cancel_url: `${(process.env.SITE_URL || '').trim()}?payment=cancelled`,
      customer_email: decoded.email,
      metadata: { uid: decoded.uid },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('create-checkout error:', err);
    res.status(500).json({ error: err.message, type: err.type, code: err.code });
  }
};
