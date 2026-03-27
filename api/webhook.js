const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  initAdmin();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    if (uid) {
      await admin.firestore().doc(`users/${uid}`).set(
        { plan: 'premium', stripeCustomerId: session.customer, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      console.log(`Upgraded user ${uid} to premium`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    // Downgrade user if they cancel
    const subscription = event.data.object;
    const customerId = subscription.customer;
    // Find user by stripeCustomerId and downgrade
    const snapshot = await admin.firestore()
      .collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({ plan: 'free', updatedAt: new Date().toISOString() });
      console.log(`Downgraded customer ${customerId} to free`);
    }
  }

  res.json({ received: true });
};
