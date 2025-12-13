import textToSpeech from '@google-cloud/text-to-speech';
import type { google } from '@google-cloud/text-to-speech/build/protos/protos.js';
import { config } from '../config.js';
import type { TranslationDirection } from '../websocket/types.js';

let client: textToSpeech.TextToSpeechClient | null = null;

function getClient(): textToSpeech.TextToSpeechClient | null {
  if (!config.googleTts.credentialsJson) {
    return null;
  }

  if (!client) {
    try {
      const credentials = JSON.parse(config.googleTts.credentialsJson);
      client = new textToSpeech.TextToSpeechClient({ credentials });
      console.log('Google Cloud TTS client initialized');
    } catch (error) {
      console.error('Failed to initialize Google TTS client:', error);
      return null;
    }
  }
  return client;
}

export function isGoogleTtsConfigured(): boolean {
  return !!config.googleTts.credentialsJson;
}

export function getVoiceConfig(direction: TranslationDirection): {
  languageCode: string;
  voiceName: string;
} {
  if (direction === 'es-to-en') {
    return {
      languageCode: 'en-US',
      voiceName: config.googleTts.voiceNameEn,
    };
  } else {
    return {
      languageCode: 'es-ES',
      voiceName: config.googleTts.voiceNameEs,
    };
  }
}

export async function synthesizeSpeech(
  text: string,
  direction: TranslationDirection
): Promise<Buffer | null> {
  const ttsClient = getClient();
  if (!ttsClient) return null;

  const { languageCode, voiceName } = getVoiceConfig(direction);

  try {
    const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);

    if (response.audioContent) {
      return Buffer.from(response.audioContent as Uint8Array);
    }
    return null;
  } catch (error) {
    console.error('Google TTS synthesis error:', error);
    return null;
  }
}
