// filepath: /Users/minkuu/Documents/krishna project /Textile-Pattern-Defect-Detection-System/frontend/src/authService.js
import { auth, db } from './firebaseClient';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  sendEmailVerification as fbSendEmailVerification,
  updateProfile as fbUpdateProfile,
  reload,
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

export async function updateUserProfile(profile) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  const payload = {
    displayName: (profile?.displayName || '').trim() || null,
    photoURL: (profile?.photoURL || '').trim() || null,
  };

  await fbUpdateProfile(user, payload);
  await reload(user);
  return auth.currentUser;
}

export async function isAdmin(uid) {
  const fallbackEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const currentEmail = auth.currentUser?.email?.toLowerCase() || '';
  if (currentEmail && fallbackEmails.includes(currentEmail)) {
    return true;
  }

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
