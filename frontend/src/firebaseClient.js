// filepath: /Users/minkuu/Documents/krishna project /Textile-Pattern-Defect-Detection-System/frontend/src/firebaseClient.js
// Initialize Firebase and export commonly used services
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase config (provided)
const firebaseConfig = {
  apiKey: "AIzaSyD885u3svKsRO6SyIZzqnszae0SckE9AIQ",
  authDomain: "miniproject-7a962.firebaseapp.com",
  projectId: "miniproject-7a962",
  storageBucket: "miniproject-7a962.firebasestorage.app",
  messagingSenderId: "20764544783",
  appId: "1:20764544783:web:d5ac97042a87d41082f87a",
  measurementId: "G-9BPZ1C2QC5",
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
