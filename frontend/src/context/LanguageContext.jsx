import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'om', label: 'Afaan Oromoo', native: 'Afaan Oromoo', flag: '🌳' },
  { code: 'am', label: 'Amharic', native: 'አማርኛ', flag: '🇪🇹' },
];

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('app_language') || 'en';
  });

  const setLanguage = (langCode) => {
    if (translations[langCode]) {
      setLanguageState(langCode);
      localStorage.setItem('app_language', langCode);
    }
  };

  const t = (key, fallback = '') => {
    const currentDict = translations[language] || translations.en;
    if (currentDict && currentDict[key] !== undefined) {
      return currentDict[key];
    }
    // Fallback to English if missing in current language
    if (translations.en && translations.en[key] !== undefined) {
      return translations.en[key];
    }
    return fallback || key;
  };

  const currentLanguageObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: SUPPORTED_LANGUAGES,
        currentLanguage: currentLanguageObj,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
