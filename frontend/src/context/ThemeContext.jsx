import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // If the user has explicitly manually toggled their theme, honor their preference
    const manualToggle = localStorage.getItem('fleet_theme_manual');
    const saved = localStorage.getItem('fleet_theme');
    if (manualToggle === 'true' && (saved === 'light' || saved === 'dark')) {
      return saved;
    }
    // Default setting is light mode for both admin and drivers
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    localStorage.setItem('fleet_theme', theme);
  }, [theme]);

  const updateTheme = (newTheme) => {
    localStorage.setItem('fleet_theme_manual', 'true');
    setTheme(newTheme);
  };

  const toggleTheme = () => {
    localStorage.setItem('fleet_theme_manual', 'true');
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: updateTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
