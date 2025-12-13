import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode');
    if (savedTheme) {
      const darkMode = savedTheme === 'dark';
      setIsDarkMode(darkMode);
      applyTheme(darkMode);
    } else {
      // Default to dark mode
      applyTheme(true);
    }
  }, []);

  const applyTheme = (darkMode) => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
      root.style.setProperty('--bg-primary', '#171717');
      root.style.setProperty('--bg-secondary', '#2a2a2a');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#8d8c8d');
      root.style.setProperty('--text-muted', '#666666');
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
    } else {
      // Apply explicit light theme attribute so CSS selectors like [data-theme='light'] take effect
      root.setAttribute('data-theme', 'light');
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f5f5f5');
      root.style.setProperty('--text-primary', '#171717');
      root.style.setProperty('--text-secondary', '#666666');
      root.style.setProperty('--text-muted', '#999999');
      root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
    }
  };

  const toggleTheme = () => {
    setIsDarkMode((prevMode) => {
      const newMode = !prevMode;
      applyTheme(newMode);
      localStorage.setItem('theme-mode', newMode ? 'dark' : 'light');
      return newMode;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
