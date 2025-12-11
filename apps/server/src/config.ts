import dotenv from 'dotenv';

// Load .env file (only needed in development)
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
  },

  deepl: {
    apiKey: process.env.DEEPL_API_KEY || '',
  },
};

export function validateConfig(): void {
  const missing: string[] = [];

  if (!config.deepgram.apiKey) {
    missing.push('DEEPGRAM_API_KEY');
  }

  if (!config.deepl.apiKey) {
    missing.push('DEEPL_API_KEY');
  }

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Some features may not work. See .env.example for required variables.');
  }
}
