// src/firebase.js
// Replace the below config object with your own Firebase project config
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];
const missing = requiredKeys.filter(k => !import.meta.env[k]);
export const configHealth = {
  ok: missing.length === 0,
  missing,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};
if (!configHealth.ok) {
  console.error('[firebase] Missing Firebase env variables in .env.local:', missing.join(', '));
  // Helpful hint for projectId undefined -> Firestore Listen 400
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    console.error('[firebase] VITE_FIREBASE_PROJECT_ID is undefined. Firestore real-time listeners will fail with projects/undefined.');
  }
} else {
  console.log('[firebase] Config health OK, projectId:', configHealth.projectId);
}

let app;
try {
  // Validate required config before initializing
  const missingRequired = requiredKeys.filter(k => !import.meta.env[k] || import.meta.env[k].trim() === '');
  if (missingRequired.length > 0) {
    console.error('[firebase] Missing required Firebase config:', missingRequired);
    throw new Error(`Missing required Firebase config: ${missingRequired.join(', ')}`);
  }
  
  // Validate config values are reasonable
  const configValues = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  };
  
  // Check for obviously invalid values
  if (configValues.apiKey && !configValues.apiKey.startsWith('AIza')) {
    throw new Error('Invalid Firebase API key format');
  }
  if (configValues.appId && !configValues.appId.includes(':')) {
    throw new Error('Invalid Firebase App ID format');
  }
  
  console.log('[firebase] Initializing Firebase app with project:', configValues.projectId);
  
  app = initializeApp(configValues);
  console.log('[firebase] Firebase app initialized successfully');
} catch (error) {
  console.error('[firebase] Failed to initialize Firebase app:', error);
  console.error('[firebase] Config validation details:', {
    hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
    apiKeyStartsWithAIza: import.meta.env.VITE_FIREBASE_API_KEY?.startsWith('AIza'),
    hasAuthDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
    hasStorageBucket: !!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    hasMessagingSenderId: !!import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    hasAppId: !!import.meta.env.VITE_FIREBASE_APP_ID,
    appIdHasColon: import.meta.env.VITE_FIREBASE_APP_ID?.includes(':'),
  });
  throw error;
}
export { app };
// Optional App Check: requires VITE_FIREBASE_APPCHECK_KEY (reCAPTCHA v3 site key)
// Temporarily disabled for debugging admin authentication issues
/*
const appCheckKey = import.meta.env.VITE_FIREBASE_APPCHECK_KEY;
if (app && appCheckKey && appCheckKey.trim()) {
  // Allow a debug token in local dev for easier testing
  if (import.meta.env.FIREBASE_APPCHECK_DEBUG_TOKEN) {
    // eslint-disable-next-line no-undef
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey.trim()),
    isTokenAutoRefreshEnabled: true,
  });
}
*/

export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

// Initialize Analytics (only in production and when supported)
export let analytics = null;
if (app && import.meta.env.PROD && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('[firebase] Analytics initialized');
    } else {
      console.log('[firebase] Analytics not supported in this environment');
    }
  }).catch((error) => {
    console.warn('[firebase] Analytics initialization failed:', error);
  });
}
// Prefer a custom Functions domain if provided (great when Firebase web config isn't set locally)
const customDomain = import.meta.env.VITE_FIREBASE_FUNCTIONS_CUSTOM_DOMAIN || undefined;
const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_CUSTOM_DOMAIN ? undefined : (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || undefined);

let functionsInstance;
try {
  functionsInstance = app ? getFunctions(app) : null;
  console.log('[firebase] getFunctions() called', { hasApp: !!app, hasFunctions: !!functionsInstance });
} catch (error) {
  console.error('[firebase] getFunctions() failed:', error);
  functionsInstance = null;
}

export const functions = functionsInstance;

if (functions) {
  console.log('[firebase] Functions initialized successfully', { region, customDomain });
} else {
  console.warn('[firebase] Functions not initialized - app may be null or getFunctions failed');
}

// Optional: connect to Functions emulator if enabled via env flag
if (functions && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === '1') {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('[firebase] Connected Functions to emulator at localhost:5001');
  } catch (e) {
    console.warn('[firebase] Failed to connect Functions emulator:', e);
  }
}
