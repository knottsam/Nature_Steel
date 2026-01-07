import React, { createContext, useContext, useEffect, useState } from 'react'
import { onSnapshot, setDoc } from 'firebase/firestore'
import { DEFAULT_SITE_VISIBILITY, SITE_VISIBILITY_DOC } from '../config/siteVisibility.js'

const SiteConfigContext = createContext({
  config: DEFAULT_SITE_VISIBILITY,
  loading: true,
  updateConfig: async () => {},
})

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_SITE_VISIBILITY)
  const [loading, setLoading] = useState(true)

  const updateConfig = async (updates) => {
    try {
      await setDoc(SITE_VISIBILITY_DOC, { ...config, ...updates }, { merge: true })
      setConfig(prev => ({ ...prev, ...updates }))
    } catch (error) {
      console.error('[SiteConfig] Update failed:', error)
      throw error
    }
  }

  useEffect(() => {
    const unsubscribe = onSnapshot(
      SITE_VISIBILITY_DOC,
      (snapshot) => {
        if (!snapshot.exists()) {
          console.log('[SiteConfig] Document does not exist, using defaults');
          setConfig(DEFAULT_SITE_VISIBILITY);
          setLoading(false);
        } else {
          setConfig({
            ...DEFAULT_SITE_VISIBILITY,
            ...snapshot.data(),
          });
          setLoading(false);
        }
      },
      (error) => {
        console.error('[SiteConfig] Listener error:', error);
        // On error, fall back to defaults instead of failing
        setConfig(DEFAULT_SITE_VISIBILITY);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, loading, updateConfig }}>
      {children}
    </SiteConfigContext.Provider>
  )
}

export const useSiteConfig = () => useContext(SiteConfigContext)
