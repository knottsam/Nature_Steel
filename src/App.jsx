import React, { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import Footer from './components/Footer.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoadingSkeleton from './components/LoadingSkeleton.jsx'
import PageTracker from './components/PageTracker.jsx'
import WebVitalsTracker from './components/WebVitalsTracker.jsx'
import ToastContainer from './components/ToastContainer.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import './index.css'

export default function App() {
  // Set to true to show under construction overlay
  const UNDER_CONSTRUCTION = false;

  const location = useLocation();

  // Global scroll to top handler
  useEffect(() => {
    const handleRouteChange = () => {
      // Force scroll to top with multiple methods
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Listen for navigation events
    window.addEventListener('beforeunload', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);

    // Also handle programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(state, title, url) {
      originalPushState.apply(this, arguments);
      setTimeout(handleRouteChange, 0);
    };

    history.replaceState = function(state, title, url) {
      originalReplaceState.apply(this, arguments);
      setTimeout(handleRouteChange, 0);
    };

    return () => {
      window.removeEventListener('beforeunload', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  // Also handle location changes
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  return (
    <>
      <ToastProvider>
        <CartProvider>
          <PageTracker />
          <WebVitalsTracker />
          {/* Skip links for accessibility */}
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <a href="#navigation" className="skip-link">Skip to navigation</a>

          {UNDER_CONSTRUCTION && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              color: '#ffffff',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              padding: '20px'
            }}>
              <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧 Under Construction 🚧</h1>
              <p style={{ fontSize: '1.5rem', maxWidth: '600px' }}>
                We're working hard to bring you something amazing. Please check back soon!
              </p>
            </div>
          )}
          
          <div className="app">
            <NavBar />
            <main className="container" id="main-content">
              <ErrorBoundary>
                <Suspense fallback={
                  <LoadingSkeleton type="page" />
                }>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </main>
            <Footer />
          </div>
          <ToastContainer />
        </CartProvider>
      </ToastProvider>
    </>
  )
}
