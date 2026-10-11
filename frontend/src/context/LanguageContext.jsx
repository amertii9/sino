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

  const setLanguage = (langCode, userId = null) => {
    if (translations[langCode]) {
      setLanguageState(langCode);
      localStorage.setItem('app_language', langCode);

      // If userId is provided or present in localStorage, mark as manual choice
      let targetUid = userId;
      if (!targetUid) {
        try {
          const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
          if (savedUser?.id) targetUid = savedUser.id;
        } catch (e) {}
      }

      if (targetUid) {
        localStorage.setItem(`user_lang_${targetUid}`, langCode);
        localStorage.setItem(`user_manual_lang_${targetUid}`, 'true');
      }
    }
  };

  const applyUserLanguage = (user) => {
    if (!user || !user.id) return;
    const manualChoice = localStorage.getItem(`user_manual_lang_${user.id}`);
    const savedUserLang = localStorage.getItem(`user_lang_${user.id}`);

    if (manualChoice && savedUserLang && translations[savedUserLang]) {
      // Driver or user previously picked this language manually
      setLanguageState(savedUserLang);
      localStorage.setItem('app_language', savedUserLang);
      return;
    }

    // Newly created or default driver accounts automatically use Afaan Oromoo ('om')
    if (user.role === 'driver') {
      const defaultDriverLang = user.preferred_language || 'om';
      setLanguageState(defaultDriverLang);
      localStorage.setItem('app_language', defaultDriverLang);
      localStorage.setItem(`user_lang_${user.id}`, defaultDriverLang);
    } else if (user.preferred_language && translations[user.preferred_language]) {
      setLanguageState(user.preferred_language);
      localStorage.setItem('app_language', user.preferred_language);
      localStorage.setItem(`user_lang_${user.id}`, user.preferred_language);
    }
  };

  useEffect(() => {
    const handleLangChange = (e) => {
      if (e.detail?.language && translations[e.detail.language]) {
        setLanguageState(e.detail.language);
      }
    };
    window.addEventListener('app_language_changed', handleLangChange);
    return () => window.removeEventListener('app_language_changed', handleLangChange);
  }, []);

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
        applyUserLanguage,
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
