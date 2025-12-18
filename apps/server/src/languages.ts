export type LanguageCode = 'en' | 'es' | 'zh' | 'fr' | 'de' | 'da' | 'it';

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  nativeName: string;
  // Deepgram STT
  deepgramCode: string;
  // DeepL Translation
  deeplSourceCode: string;
  deeplTargetCode: string;
  // Google TTS
  googleTtsCode: string;
  googleTtsVoice: string;
}

export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    deepgramCode: 'en',
    deeplSourceCode: 'en',
    deeplTargetCode: 'en-US',
    googleTtsCode: 'en-US',
    googleTtsVoice: 'en-US-Neural2-C',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    deepgramCode: 'es',
    deeplSourceCode: 'es',
    deeplTargetCode: 'es',
    googleTtsCode: 'es-ES',
    googleTtsVoice: 'es-ES-Neural2-A',
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    deepgramCode: 'zh',
    deeplSourceCode: 'zh',
    deeplTargetCode: 'zh',
    googleTtsCode: 'cmn-CN',
    googleTtsVoice: 'cmn-CN-Neural2-A',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    deepgramCode: 'fr',
    deeplSourceCode: 'fr',
    deeplTargetCode: 'fr',
    googleTtsCode: 'fr-FR',
    googleTtsVoice: 'fr-FR-Neural2-A',
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    deepgramCode: 'de',
    deeplSourceCode: 'de',
    deeplTargetCode: 'de',
    googleTtsCode: 'de-DE',
    googleTtsVoice: 'de-DE-Neural2-A',
  },
  da: {
    code: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    deepgramCode: 'da',
    deeplSourceCode: 'da',
    deeplTargetCode: 'da',
    googleTtsCode: 'da-DK',
    googleTtsVoice: 'da-DK-Neural2-D',
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    deepgramCode: 'it',
    deeplSourceCode: 'it',
    deeplTargetCode: 'it',
    googleTtsCode: 'it-IT',
    googleTtsVoice: 'it-IT-Neural2-A',
  },
};

// Helper to get language config
export function getLanguageConfig(code: LanguageCode): LanguageConfig {
  return SUPPORTED_LANGUAGES[code];
}

// Helper to check if a language code is valid
export function isValidLanguageCode(code: string): code is LanguageCode {
  return code in SUPPORTED_LANGUAGES;
}

// Get all language codes
export function getAllLanguageCodes(): LanguageCode[] {
  return Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[];
}

// Get languages as array for UI dropdowns
export function getLanguagesForDropdown(): Array<{ code: LanguageCode; name: string; nativeName: string }> {
  return Object.values(SUPPORTED_LANGUAGES).map(({ code, name, nativeName }) => ({
    code,
    name,
    nativeName,
  }));
}
