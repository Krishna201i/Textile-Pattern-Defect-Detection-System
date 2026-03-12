import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../authService';

export default function SignupPage({ onSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email) return setError('Please enter an email');
    if (!password) return setError('Please enter a password');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const user = await signUp(email, password);
      if (onSignup) onSignup(user);
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page modern auth-page-pro auth-login-redesign">
      <div className="auth-card modern-card auth-login-card auth-signup-card">
        <div className="auth-login-hero">
          <p className="auth-eyebrow">Enterprise Textile Quality Platform</p>
          <h2 className="auth-hero-title">Create your workspace</h2>
          <p className="auth-hero-copy">
            Set up secure access to scan operations, quality analytics, and role-based controls.
          </p>

          <div className="auth-hero-metrics">
            <div className="auth-hero-metric">
              <strong>Centralized History</strong>
              <span>Shared records across user and admin</span>
            </div>
            <div className="auth-hero-metric">
              <strong>Textile Analytics</strong>
              <span>Confidence, risk, and source trends</span>
            </div>
            <div className="auth-hero-metric">
              <strong>Secure Workflow</strong>
              <span>Auth + managed quality operations</span>
            </div>
          </div>
        </div>

        <div className="auth-login-form-panel auth-signup-form-panel">
          <h3>Create account</h3>
          <p className="muted">Create your account to start saving scans and viewing analytics.</p>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>

            <div className="auth-field">
              <label className="auth-label-spaced">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Choose a strong password" />
            </div>

            <div className="auth-field">
              <label className="auth-label-spaced">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirm password" />
            </div>

            <div className="auth-submit-row">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create account'}
              </button>
            </div>

            {error && <div className="error auth-message">{error}</div>}
          </form>

          <div className="auth-footer-text">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
