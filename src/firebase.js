// src/firebase.js
// Replace the below config object with your own Firebase project config
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAcx57ikOep6HhtMknq_G4kakMlMwCjugw",
  authDomain: "nature-and-steel.firebaseapp.com",
  projectId: "nature-and-steel",
  storageBucket: "nature-and-steel.firebasestorage.app",
  messagingSenderId: "998222720496",
  appId: "1:998222720496:web:535756bea0dd790bcb0135",
  measurementId: "G-FB5CMER1TH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
