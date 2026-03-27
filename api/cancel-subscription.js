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
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(token);

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: decoded.email, limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({ error: 'No Stripe customer found' });
    }

    const customerId = customers.data[0].id;

    // Find active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (!subscriptions.data.length) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel at period end (they keep access until billing cycle ends)
    await stripe.subscriptions.update(subscriptions.data[0].id, {
      cancel_at_period_end: true,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('cancel-subscription error:', err);
    res.status(500).json({ error: err.message });
  }
};
