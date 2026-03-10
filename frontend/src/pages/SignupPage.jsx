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
    <div className="auth-page modern auth-page-pro">
      <div className="auth-card modern-card auth-card-pro">
        <div className="auth-split">
          <div className="auth-side auth-side-illustration auth-side-pro">
            <div className="brand auth-brand-pro">
              <p className="auth-eyebrow">Enterprise Quality Platform</p>
              <h3 className="auth-brand-title">Create your workspace</h3>
              <p>Set up your secure account to manage scans and analytics.</p>
            </div>
            <ul className="auth-side-points">
              <li>Save and organize scan history</li>
              <li>Track quality performance over time</li>
              <li>Access role-based admin capabilities</li>
            </ul>
          </div>

          <div className="auth-side auth-side-form">
            <h2>Create account</h2>
            <p className="muted">Create an account to save scans and access analytics.</p>

            <form onSubmit={handleSubmit}>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />

              <label className="auth-label-spaced">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Choose a strong password" />

              <label className="auth-label-spaced">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirm password" />

              <div className="auth-submit-row">
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
              </div>

              {error && <div className="error auth-message">{error}</div>}
            </form>

            <div className="auth-footer-text">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
