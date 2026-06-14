import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    // One-time migration: force everyone onto dark mode (overriding any
    // previously saved preference). After this runs once, the user's own
    // toggle choices are respected as normal.
    const FORCE_DARK_KEY = 'themeForcedDark-v1'
    const savedTheme = localStorage.getItem('theme')

    if (!localStorage.getItem(FORCE_DARK_KEY)) {
      setTheme('dark')
      localStorage.setItem('theme', 'dark')
      localStorage.setItem(FORCE_DARK_KEY, '1')
    } else if (savedTheme) {
      setTheme(savedTheme)
    } else {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme)
    // Save to localStorage
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)