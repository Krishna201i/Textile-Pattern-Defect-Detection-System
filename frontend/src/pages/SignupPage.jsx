import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../authService';
import GradientText from '../components/GradientText';

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
    <div className="auth-page">
      <div className="auth-card">
        <GradientText
          className="auth-gradient-title"
          colors={['#7aa2ff', '#bcd3ff', '#d9e5ff']}
          animationSpeed={10}
          direction="horizontal"
        >
          <h2 style={{ marginBottom: 8 }}>Create account</h2>
        </GradientText>
        <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>Create an account to save scans and access analytics</p>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />

          <label style={{ marginTop: 10 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Choose a strong password" />

          <label style={{ marginTop: 10 }}>Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirm password" />

          <div style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
          </div>

          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        </form>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
