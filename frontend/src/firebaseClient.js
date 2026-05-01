// frontend/src/firebaseClient.js — Initialize Firebase and export commonly used services
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase config (provided)
const firebaseConfig = {
  apiKey: "AIzaSyBg1Rk666R0F6tju-qL2TXQbel7gPB1zQ0",
  authDomain: "pattern-detection-system.firebaseapp.com",
  projectId: "pattern-detection-system",
  storageBucket: "pattern-detection-system.firebasestorage.app",
  messagingSenderId: "963466434993",
  appId: "1:963466434993:web:5ab675b30ebbdc91058590",
  measurementId: "G-D78KM8N0X7"
};

// Initialize app
export const firebaseApp = initializeApp(firebaseConfig);

// Analytics may not be available in some environments (SSR) — guard it
let analytics = null;
try {
  analytics = getAnalytics(firebaseApp);
} catch (err) {
  // Not fatal — analytics is optional and may throw in non-browser envs
  // console.warn('Firebase analytics not initialized:', err);
}
export { analytics };

// Export Auth, Firestore and Storage instances for use in the app
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Usage example:
// import { db, storage, auth } from './firebaseClient';
