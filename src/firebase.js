// src/firebase.js
// Replace the below config object with your own Firebase project config
import { initializeApp } from 'firebase/app';
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

export const app = initializeApp(firebaseConfig);
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
    // eslint-disable-next-line no-console
    console.log('[firebase] Connected Functions to emulator at localhost:5001');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] Failed to connect Functions emulator:', e);
  }
}
