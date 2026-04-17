import { config } from '../config.js';
import { LegacyPipeline } from './legacy-pipeline.js';
import { DeepLVoicePipeline } from './deepl-voice-pipeline.js';
import type { TranslationPipeline } from './pipeline.js';

let instance: TranslationPipeline | null = null;

export function getPipeline(): TranslationPipeline {
  if (!instance) {
    if (config.translationPipeline === 'deepl-voice') {
      console.log('Using DeepL Voice pipeline');
      instance = new DeepLVoicePipeline();
    } else {
      console.log('Using legacy pipeline (Deepgram + DeepL + Google TTS)');
      instance = new LegacyPipeline();
    }
  }
  return instance;
}
