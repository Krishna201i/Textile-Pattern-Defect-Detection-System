// filepath: /Users/minkuu/Documents/krishna project /Textile-Pattern-Defect-Detection-System/frontend/src/authService.js
import { auth, db } from './firebaseClient';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  sendEmailVerification as fbSendEmailVerification,
} from 'firebase/auth';

export async function signUp(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Send verification email
  try {
    await fbSendEmailVerification(cred.user);
  } catch (e) {
    // Non-fatal
    console.warn('Failed to send verification email:', e);
  }
  return cred.user;
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  return fbSignOut(auth);
}

export function onAuthChange(cb) {
  // Returns unsubscribe function
  return onAuthStateChanged(auth, cb);
}

export async function sendPasswordReset(email) {
  return fbSendPasswordResetEmail(auth, email);
}

export async function sendVerificationEmail(user) {
  // Accept either user object or use current user
  const u = user || auth.currentUser;
  if (!u) throw new Error('No authenticated user to verify');
  return fbSendEmailVerification(u);
}

export async function isAdmin(uid) {
  if (!db) return false;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const d = await getDoc(doc(db, 'admins', uid));
    return d.exists();
  } catch (e) {
    console.error('Failed to check admin status', e);
    return false;
  }
}
