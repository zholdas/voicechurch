import dotenv from 'dotenv';

// Load .env file (only needed in development)
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Translation pipeline: 'legacy' (Deepgram+DeepL+GoogleTTS) or 'deepl-voice' (DeepL Voice API)
  translationPipeline: (process.env.TRANSLATION_PIPELINE || 'legacy') as 'legacy' | 'deepl-voice',

  // Source language mode: 'auto' (Deepgram multi/DeepL auto-detect) or 'manual' (fixed language)
  sourceLanguageMode: (process.env.SOURCE_LANGUAGE_MODE || 'manual') as 'auto' | 'manual',

  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
  },

  apple: {
    clientId: process.env.APPLE_CLIENT_ID || 'com.voicechurch.broadcaster',
    webClientId: process.env.APPLE_WEB_CLIENT_ID || '',
    teamId: process.env.APPLE_TEAM_ID || '',
    keyId: process.env.APPLE_KEY_ID || '',
    privateKey: (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },

  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
  },

  deepl: {
    apiKey: process.env.DEEPL_API_KEY || '',
  },

  deeplVoice: {
    apiKey: process.env.DEEPL_VOICE_API_KEY || process.env.DEEPL_API_KEY || '',
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

  stripe: (() => {
    const mode = process.env.STRIPE_MODE || 'test';
    const isLive = mode === 'live';
    const prefix = isLive ? 'STRIPE_LIVE' : 'STRIPE_TEST';
    return {
      mode,
      secretKey: process.env[`${prefix}_SECRET_KEY`] || process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env[`${prefix}_WEBHOOK_SECRET`] || process.env.STRIPE_WEBHOOK_SECRET || '',
      prices: {
        starterMonthly: process.env[`${prefix}_PRICE_STARTER_MONTHLY`] || process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
        starterYearly: process.env[`${prefix}_PRICE_STARTER_YEARLY`] || process.env.STRIPE_PRICE_STARTER_YEARLY || '',
        growingMonthly: process.env[`${prefix}_PRICE_GROWING_MONTHLY`] || process.env.STRIPE_PRICE_GROWING_MONTHLY || '',
        growingYearly: process.env[`${prefix}_PRICE_GROWING_YEARLY`] || process.env.STRIPE_PRICE_GROWING_YEARLY || '',
        multiplyingMonthly: process.env[`${prefix}_PRICE_MULTIPLYING_MONTHLY`] || process.env.STRIPE_PRICE_MULTIPLYING_MONTHLY || '',
        multiplyingYearly: process.env[`${prefix}_PRICE_MULTIPLYING_YEARLY`] || process.env.STRIPE_PRICE_MULTIPLYING_YEARLY || '',
        eventPass: process.env[`${prefix}_PRICE_EVENT_PASS`] || process.env.STRIPE_PRICE_EVENT_PASS || '',
      },
    };
  })(),

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  r2: {
    endpoint: process.env.R2_ENDPOINT || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || 'wordbeacon-recordings',
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
    console.info('Info: Stripe not configured. Set STRIPE_TEST_SECRET_KEY or STRIPE_LIVE_SECRET_KEY to enable subscriptions.');
  } else {
    console.info(`Info: Stripe configured in ${config.stripe.mode.toUpperCase()} mode`);
  }
}

export function isStripeConfigured(): boolean {
  return !!config.stripe.secretKey;
}
