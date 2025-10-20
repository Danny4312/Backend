const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// M-Pesa configuration
const mpesaConfig = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE,
  passkey: process.env.MPESA_PASSKEY,
  environment: process.env.MPESA_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
  callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://your-domain.com/api/payments/mpesa/callback',
  accountReference: 'iSafari Global',
  transactionDesc: 'Payment for iSafari Global services'
};

// Generate M-Pesa access token
const getMpesaAccessToken = async () => {
  const auth = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');
  
  try {
    const response = await fetch(
      `https://${mpesaConfig.environment === 'production' ? 'api' : 'sandbox'}.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('M-Pesa access token error:', error);
    throw error;
  }
};

// Generate M-Pesa password
const generateMpesaPassword = () => {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${mpesaConfig.businessShortCode}${mpesaConfig.passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
};

// Initiate M-Pesa STK Push
const initiateMpesaPayment = async (phoneNumber, amount, accountReference, transactionDesc) => {
  try {
    const accessToken = await getMpesaAccessToken();
    const { password, timestamp } = generateMpesaPassword();
    
    const stkPushData = {
      BusinessShortCode: mpesaConfig.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phoneNumber,
      PartyB: mpesaConfig.businessShortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: mpesaConfig.callbackUrl,
      AccountReference: accountReference || mpesaConfig.accountReference,
      TransactionDesc: transactionDesc || mpesaConfig.transactionDesc
    };

    const response = await fetch(
      `https://${mpesaConfig.environment === 'production' ? 'api' : 'sandbox'}.safaricom.co.ke/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stkPushData)
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('M-Pesa STK Push error:', error);
    throw error;
  }
};

// Create Stripe payment intent
const createStripePaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: currency.toLowerCase(),
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error('Stripe payment intent error:', error);
    throw error;
  }
};

// Verify Stripe payment
const verifyStripePayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Stripe payment verification error:', error);
    throw error;
  }
};

// Process payment based on method
const processPayment = async (paymentData) => {
  const { method, amount, currency, phoneNumber, metadata } = paymentData;

  switch (method) {
    case 'mpesa':
      if (!phoneNumber) {
        throw new Error('Phone number is required for M-Pesa payments');
      }
      // Convert USD to KES (approximate rate)
      const kesAmount = currency === 'usd' ? amount * 130 : amount;
      return await initiateMpesaPayment(
        phoneNumber,
        kesAmount,
        metadata.accountReference,
        metadata.transactionDesc
      );

    case 'stripe':
      return await createStripePaymentIntent(amount, currency, metadata);

    default:
      throw new Error(`Unsupported payment method: ${method}`);
  }
};

// Payment method configurations
const paymentMethods = {
  mpesa: {
    name: 'M-Pesa',
    currency: 'KES',
    countries: ['KE'],
    icon: '📱',
    description: 'Pay with M-Pesa mobile money'
  },
  stripe: {
    name: 'Credit/Debit Card',
    currency: 'USD',
    countries: ['US', 'CA', 'GB', 'AU', 'EU'],
    icon: '💳',
    description: 'Pay with credit or debit card'
  },
  paypal: {
    name: 'PayPal',
    currency: 'USD',
    countries: ['US', 'CA', 'GB', 'AU', 'EU'],
    icon: '🅿️',
    description: 'Pay with PayPal account'
  }
};

module.exports = {
  stripe,
  mpesaConfig,
  getMpesaAccessToken,
  generateMpesaPassword,
  initiateMpesaPayment,
  createStripePaymentIntent,
  verifyStripePayment,
  processPayment,
  paymentMethods
};
