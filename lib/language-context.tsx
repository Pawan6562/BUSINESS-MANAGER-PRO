import React, { createContext, useContext, useState, useEffect } from 'react';
import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, rtlLanguages, isRTL } from '../locales/index';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  isRTL: boolean;
  availableLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isRTLState, setIsRTLState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>(['en']);

  // Load saved language on app start
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = (await AsyncStorage.getItem('app_language')) as Language | null;
        const validLanguages: Language[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko',
          'ar', 'hi', 'bn', 'ur', 'fa', 'tr', 'pl', 'uk', 'ro', 'nl',
          'sv', 'no', 'da', 'fi', 'cs', 'hu', 'el', 'he', 'th', 'vi',
          'id', 'ms', 'tl', 'sk', 'sl', 'bg', 'hr', 'sr', 'et', 'lt',
          'lv', 'mk', 'sq', 'hy', 'ka', 'kk', 'uz', 'ta', 'te', 'ml',
          'kn', 'gu', 'mr', 'pa', 'my', 'km', 'lo', 'am', 'sw'];

        setAvailableLanguages(validLanguages);

        if (savedLanguage && validLanguages.includes(savedLanguage)) {
          setLanguageState(savedLanguage);
          const shouldBeRTL = isRTL(savedLanguage);
          setIsRTLState(shouldBeRTL);

          // Apply RTL setting if needed
          if (shouldBeRTL !== I18nManager.isRTL) {
            I18nManager.forceRTL(shouldBeRTL);
          }
        }
      } catch (error) {
        console.error('Error loading language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = async (newLanguage: Language) => {
    try {
      // Determine if new language is RTL
      const newIsRTL = isRTL(newLanguage);
      const currentIsRTL = I18nManager.isRTL;

      // Check if RTL status needs to change
      if (newIsRTL !== currentIsRTL) {
        // Force RTL setting
        I18nManager.forceRTL(newIsRTL);

        // Save language preference
        await AsyncStorage.setItem('app_language', newLanguage);

        // Update state
        setLanguageState(newLanguage);
        setIsRTLState(newIsRTL);

        // Alert user to restart app
        Alert.alert(
          'Restart Required',
          'Please close and reopen the app to apply language changes.',
          [{ text: 'OK' }]
        );
      } else {
        // No RTL change needed, just update language
        await AsyncStorage.setItem('app_language', newLanguage);
        setLanguageState(newLanguage);
        setIsRTLState(newIsRTL);
      }
    } catch (error) {
      console.error('Error setting language:', error);
    }
  };

  if (isLoading) {
    return null; // Or return a loading screen
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL: isRTLState, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
