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
    <div className="auth-page modern">
      <div className="auth-card modern-card">
        <div className="auth-split">
          <div className="auth-side auth-side-illustration">
            <div className="brand">
              <h3>TextileGuard</h3>
              <p>AI fabric defect detection</p>
            </div>
            <div className="side-note">Securely save your scans and track analytics.</div>
          </div>

          <div className="auth-side auth-side-form">
            <h2>Welcome back</h2>
            <p className="muted">Sign in to continue to your dashboard</p>

            <div className="social-row">
              <button className="btn btn-outline" disabled>Continue with Google</button>
              <button className="btn btn-outline" disabled style={{ marginLeft: 8 }}>Continue with GitHub</button>
            </div>

            <div className="divider"><span>or</span></div>

            <form onSubmit={handleSubmit}>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />

              <label style={{ marginTop: 10 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password" />
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 8, top: 8 }}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked readOnly />
                  <span className="muted">Remember me</span>
                </label>
                <button type="button" className="link-like" onClick={handleReset}>Forgot password?</button>
              </div>

              <div style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
              </div>

              {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
              {info && <div className="info" style={{ marginTop: 12 }}>{info}</div>}
            </form>

            <div style={{ marginTop: 14 }}>Don't have an account? <Link to="/signup">Create one</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}
