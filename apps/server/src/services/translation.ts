import * as deepl from 'deepl-node';
import { config } from '../config.js';
import type { LanguageCode } from '../languages.js';
import { getLanguageConfig } from '../languages.js';

let translator: deepl.Translator | null = null;

function getTranslator(): deepl.Translator | null {
  if (!config.deepl.apiKey) {
    return null;
  }

  if (!translator) {
    translator = new deepl.Translator(config.deepl.apiKey);
  }

  return translator;
}

export async function translate(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): Promise<string> {
  // If same language, no translation needed
  if (sourceLanguage === targetLanguage) {
    return text;
  }

  const trans = getTranslator();

  if (!trans) {
    console.warn('DeepL API key not configured, returning original text');
    return `[${sourceLanguage.toUpperCase()}] ${text}`;
  }

  try {
    const sourceLangConfig = getLanguageConfig(sourceLanguage);
    const targetLangConfig = getLanguageConfig(targetLanguage);

    const result = await trans.translateText(
      text,
      sourceLangConfig.deeplSourceCode as deepl.SourceLanguageCode,
      targetLangConfig.deeplTargetCode as deepl.TargetLanguageCode
    );
    return result.text;
  } catch (error) {
    console.error('Translation error:', error);
    return `[Translation Error] ${text}`;
  }
}

// Debounced translation for interim results
const pendingTranslations = new Map<string, NodeJS.Timeout>();

export function translateWithDebounce(
  key: string,
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  delayMs: number,
  callback: (translated: string) => void
): void {
  // Clear previous pending translation for this key
  const existing = pendingTranslations.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  // Set new delayed translation
  const timeout = setTimeout(async () => {
    pendingTranslations.delete(key);
    const translated = await translate(text, sourceLanguage, targetLanguage);
    callback(translated);
  }, delayMs);

  pendingTranslations.set(key, timeout);
}

export function cancelPendingTranslation(key: string): void {
  const existing = pendingTranslations.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingTranslations.delete(key);
  }
}
