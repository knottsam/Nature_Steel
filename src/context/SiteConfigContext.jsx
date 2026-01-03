import React, { createContext, useContext, useEffect, useState } from 'react'
import { onSnapshot, setDoc } from 'firebase/firestore'
import { DEFAULT_SITE_VISIBILITY, SITE_VISIBILITY_DOC } from '../config/siteVisibility.js'

const SiteConfigContext = createContext({
  config: DEFAULT_SITE_VISIBILITY,
  loading: true,
})

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_SITE_VISIBILITY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      SITE_VISIBILITY_DOC,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDoc(SITE_VISIBILITY_DOC, DEFAULT_SITE_VISIBILITY).catch((error) => {
            console.error('[SiteConfig] failed to seed config:', error)
          })
          setConfig(DEFAULT_SITE_VISIBILITY)
        } else {
          setConfig({
            ...DEFAULT_SITE_VISIBILITY,
            ...snapshot.data(),
          })
        }
        setLoading(false)
      },
      (error) => {
        console.error('[SiteConfig] listener error:', error)
        setLoading(false)
      },
    )
    return () => unsubscribe()
  }, [])

  return (
    <SiteConfigContext.Provider value={{ config, loading }}>
      {children}
    </SiteConfigContext.Provider>
  )
}

export const useSiteConfig = () => useContext(SiteConfigContext)
