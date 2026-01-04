// src/firebase.js
// Replace the below config object with your own Firebase project config
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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
}

export const app = initializeApp(firebaseConfig);
// Optional App Check: requires VITE_FIREBASE_APPCHECK_KEY (reCAPTCHA v3 site key)
const appCheckKey = import.meta.env.VITE_FIREBASE_APPCHECK_KEY;
if (appCheckKey) {
  // Allow a debug token in local dev for easier testing
  if (import.meta.env.FIREBASE_APPCHECK_DEBUG_TOKEN) {
    // eslint-disable-next-line no-undef
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const db = getFirestore(app);
export const storage = getStorage(app);
// Prefer a custom Functions domain if provided (great when Firebase web config isn't set locally)
const customDomain = import.meta.env.VITE_FIREBASE_FUNCTIONS_CUSTOM_DOMAIN || undefined;
const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || undefined;
export const functions = getFunctions(app, customDomain || region || undefined);

// Optional: connect to Functions emulator if enabled via env flag
if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === '1') {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('[firebase] Connected Functions to emulator at localhost:5001');
  } catch (e) {
    console.warn('[firebase] Failed to connect Functions emulator:', e);
  }
}
