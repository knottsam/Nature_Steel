// src/components/PageTracker.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics.js';

export default function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track page view when location changes
    const pageTitle = document.title || 'Nature & Steel Bespoke';
    const pageName = location.pathname === '/' ? 'Home' :
                    location.pathname.startsWith('/shop') ? 'Shop' :
                    location.pathname.startsWith('/product/') ? 'Product' :
                    location.pathname.startsWith('/artists') ? 'Artists' :
                    location.pathname.startsWith('/artist/') ? 'Artist' :
                    location.pathname.startsWith('/about') ? 'About' :
                    location.pathname.startsWith('/faq') ? 'FAQ' :
                    location.pathname.startsWith('/projects') ? 'Projects' :
                    location.pathname.startsWith('/cart') ? 'Cart' :
                    location.pathname.startsWith('/checkout') ? 'Checkout' :
                    location.pathname.startsWith('/admin') ? 'Admin' :
                    'Unknown';

    trackPageView(pageName, pageTitle);
  }, [location]);

  return null; // This component doesn't render anything
}