import dotenv from 'dotenv';

// Load .env file (only needed in development)
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
  },

  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
  },

  deepl: {
    apiKey: process.env.DEEPL_API_KEY || '',
  },

  qrMapper: {
    apiKey: process.env.QRMAPPER_API_KEY || '',
    baseUrl: 'https://app.qrmapper.com/api/1.1/wf',
    webhookUrl: process.env.QRMAPPER_WEBHOOK_URL || '',
  },

  googleTts: {
    // JSON credentials as string (for Railway/cloud deployment)
    credentialsJson: process.env.GOOGLE_CREDENTIALS_JSON || '',
    // Voice configuration
    voiceNameEn: process.env.GOOGLE_TTS_VOICE_EN || 'en-US-Neural2-C',
    voiceNameEs: process.env.GOOGLE_TTS_VOICE_ES || 'es-ES-Neural2-A',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    // Price IDs for each plan (set in Stripe Dashboard)
    prices: {
      starterMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
      starterYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
      growingMonthly: process.env.STRIPE_PRICE_GROWING_MONTHLY || '',
      growingYearly: process.env.STRIPE_PRICE_GROWING_YEARLY || '',
      multiplyingMonthly: process.env.STRIPE_PRICE_MULTIPLYING_MONTHLY || '',
      multiplyingYearly: process.env.STRIPE_PRICE_MULTIPLYING_YEARLY || '',
    },
  },

  appUrl: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
};

export function validateConfig(): void {
  const missing: string[] = [];

  if (!config.deepgram.apiKey) {
    missing.push('DEEPGRAM_API_KEY');
  }

  if (!config.deepl.apiKey) {
    missing.push('DEEPL_API_KEY');
  }

  if (config.nodeEnv === 'production' && config.session.secret === 'dev-secret-change-in-production') {
    missing.push('SESSION_SECRET');
  }

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Some features may not work. See .env.example for required variables.');
  }

  // Info about optional OAuth
  if (!config.google.clientId || !config.google.clientSecret) {
    console.info('Info: Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.');
  }

  // Info about optional QRMapper
  if (!config.qrMapper.apiKey) {
    console.info('Info: QRMapper not configured. Set QRMAPPER_API_KEY to enable QR code generation.');
  }

  // Info about optional Google TTS
  if (!config.googleTts.credentialsJson) {
    console.info('Info: Google Cloud TTS not configured. Set GOOGLE_CREDENTIALS_JSON for high-quality TTS.');
  }

  // Info about optional Stripe
  if (!config.stripe.secretKey) {
    console.info('Info: Stripe not configured. Set STRIPE_SECRET_KEY to enable subscriptions.');
  }
}

export function isStripeConfigured(): boolean {
  return !!config.stripe.secretKey;
}
