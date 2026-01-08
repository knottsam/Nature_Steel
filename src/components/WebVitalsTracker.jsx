// src/components/WebVitalsTracker.jsx
import { useEffect } from 'react';
import { trackWebVitals } from '../utils/analytics.js';

export default function WebVitalsTracker() {
  useEffect(() => {
    // Only load web-vitals in production
    if (import.meta.env.PROD) {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(trackWebVitals);
        getFID(trackWebVitals);
        getFCP(trackWebVitals);
        getLCP(trackWebVitals);
        getTTFB(trackWebVitals);
      }).catch((error) => {
        console.warn('[WebVitals] Failed to load web-vitals library:', error);
      });
    }
  }, []);

  return null; // This component doesn't render anything
}