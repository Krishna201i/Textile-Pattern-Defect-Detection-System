import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn, sendPasswordReset } from '../authService';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email) return setError('Please enter your email');
    if (!password) return setError('Please enter your password');
    setLoading(true);
    try {
      const user = await signIn(email, password);
      if (onLogin) onLogin(user);
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return setError('Enter your email to reset password');
    try {
      await sendPasswordReset(email);
      setInfo('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err?.message || 'Failed to send reset email');
    }
  };

  return (
    <div className="auth-page modern auth-page-pro">
      <div className="auth-card modern-card auth-card-pro">
        <div className="auth-split">
          <div className="auth-side auth-side-illustration auth-side-pro">
            <div className="brand auth-brand-pro">
              <p className="auth-eyebrow">Enterprise Quality Platform</p>
              <h3 className="auth-brand-title">TextileGuard</h3>
              <p>Defect intelligence for modern textile operations</p>
            </div>
            <ul className="auth-side-points">
              <li>Pattern-based inspection workflow</li>
              <li>Traceable scan history and analytics</li>
              <li>Role-based access with secure sign-in</li>
            </ul>
          </div>

          <div className="auth-side auth-side-form">
            <h2>Welcome back</h2>
            <p className="muted">Sign in to access your dashboard and scan history.</p>

            <form onSubmit={handleSubmit}>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />

              <label style={{ marginTop: 10 }}>Password</label>
              <div className="password-field-wrap">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password" />
                <button type="button" className="btn btn-sm btn-outline password-toggle" onClick={() => setShowPassword(s => !s)}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>

              <div className="auth-form-meta">
                <label className="remember-check">
                  <input type="checkbox" />
                  <span className="muted">Remember me</span>
                </label>
                <button type="button" className="link-like" onClick={handleReset}>Forgot password?</button>
              </div>

              <div className="auth-submit-row">
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
              </div>

              {error && <div className="error auth-message">{error}</div>}
              {info && <div className="info auth-message">{info}</div>}
            </form>

            <div className="auth-footer-text">Don&apos;t have an account? <Link to="/signup">Create one</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}
