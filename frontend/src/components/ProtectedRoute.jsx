// filepath: /Users/minkuu/Documents/krishna project /Textile-Pattern-Defect-Detection-System/frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../firebaseClient';

export default function ProtectedRoute({ children }) {
  const user = auth.currentUser;
  // If not signed in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
