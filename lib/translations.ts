// Import auto-generated resources from locales/index.ts
import { resources, Language, languageNames, rtlLanguages, isRTL } from '../locales/index';

export type { Language };
export { languageNames, rtlLanguages, isRTL };

// Get all available languages
export const availableLanguages: Language[] = Object.keys(resources) as Language[];

// Get translation for a specific language
export function getTranslations(language: Language) {
  return resources[language] || resources.en;
}

// Get nested translation value using dot notation
export function getTranslationValue(
  translations: any,
  path: string,
  defaultValue: string = ''
): string {
  try {
    const keys = path.split('.');
    let value = translations;

    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        return defaultValue;
      }
    }

    return typeof value === 'string' ? value : defaultValue;
  } catch {
    return defaultValue;
  }
}

// Hook for using translations in components
export function useTranslation(language: Language) {
  const translations = getTranslations(language);

  return {
    t: (key: string, defaultValue?: string) => getTranslationValue(translations, key, defaultValue),
    translations,
    language,
    isRTL: isRTL(language),
  };
}
