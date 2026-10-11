import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Globe, Check, ChevronDown } from 'lucide-react';

export const LanguageSwitcher = ({ variant = 'default' }) => {
  const { language, setLanguage, languages, currentLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition cursor-pointer ${
          variant === 'login'
            ? 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700 shadow-md'
            : 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/80 shadow-sm'
        }`}
        title="Select Language / Afaan Filadhu / ቋንቋ ይምረጡ"
      >
        <Globe className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="hidden sm:inline">{currentLanguage.flag}</span>
        <span className="hidden sm:inline font-semibold text-xs">{currentLanguage.native}</span>
        <ChevronDown className={`hidden sm:inline w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 py-1.5 divide-y divide-slate-800">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t('select_language_title', 'Select Language')}
          </div>

          <div className="py-1">
            {languages.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-400 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{lang.flag}</span>
                    <div>
                      <div className="text-xs font-bold">{lang.native}</div>
                      <div className="text-[10px] text-slate-400">{lang.label}</div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
