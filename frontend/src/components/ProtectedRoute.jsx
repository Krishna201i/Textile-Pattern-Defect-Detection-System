// filepath: /Users/minkuu/Documents/krishna project /Textile-Pattern-Defect-Detection-System/frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, user, authReady = true }) {
  if (!authReady) {
    return (
      <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
        <div className="spinner" />
        <p className="loading-text">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
