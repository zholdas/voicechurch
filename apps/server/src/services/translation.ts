import * as deepl from 'deepl-node';
import { config } from '../config.js';

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

export async function translateToEnglish(spanishText: string): Promise<string> {
  const trans = getTranslator();

  if (!trans) {
    console.warn('DeepL API key not configured, returning original text');
    return `[ES] ${spanishText}`;
  }

  try {
    const result = await trans.translateText(spanishText, 'es', 'en-US');
    return result.text;
  } catch (error) {
    console.error('Translation error:', error);
    return `[Translation Error] ${spanishText}`;
  }
}

// Debounced translation for interim results
const pendingTranslations = new Map<string, NodeJS.Timeout>();

export function translateWithDebounce(
  key: string,
  spanishText: string,
  delayMs: number,
  callback: (english: string) => void
): void {
  // Clear previous pending translation for this key
  const existing = pendingTranslations.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  // Set new delayed translation
  const timeout = setTimeout(async () => {
    pendingTranslations.delete(key);
    const english = await translateToEnglish(spanishText);
    callback(english);
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
