import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn, sendPasswordReset } from '../authService';
import { FiShield, FiBarChart2, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';

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
    <div className="auth-page modern auth-page-pro fade-in">
      <div className="auth-card modern-card auth-card-pro" style={{
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(245,166,35,0.04)"
      }}>
        <div className="auth-split">
          {/* Left: Brand / Hero Side */}
          <div className="auth-side auth-side-illustration auth-side-pro" style={{
            background: "linear-gradient(145deg, rgba(26,26,36,0.7), rgba(245,166,35,0.04))",
            position: "relative",
            overflow: "hidden"
          }}>
            {/* Decorative glow orb */}
            <div style={{
              position: "absolute",
              top: "-60px",
              right: "-60px",
              width: "200px",
              height: "200px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245,166,35,0.1), transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none"
            }} />

            <div className="brand auth-brand-pro" style={{ position: "relative", zIndex: 1 }}>
              <p className="auth-eyebrow" style={{ letterSpacing: "2px" }}>Enterprise Quality Platform</p>
              <h3 className="auth-brand-title" style={{
                fontSize: "32px",
                background: "linear-gradient(135deg, #F5A623, #E09000)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>TextileGuard</h3>
              <p style={{ lineHeight: "1.6", marginTop: "10px" }}>Defect intelligence for modern textile operations</p>
            </div>

            <div style={{
              marginTop: "28px",
              display: "grid",
              gap: "12px",
              position: "relative",
              zIndex: 1
            }}>
              {[
                { icon: <FiShield size={16} />, text: "AI-powered pattern inspection" },
                { icon: <FiBarChart2 size={16} />, text: "Traceable scan history & analytics" },
                { icon: <FiLock size={16} />, text: "Role-based access with secure auth" }
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(245,166,35,0.04)",
                  border: "1px solid rgba(245,166,35,0.06)",
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  animation: `fadeInUp 0.4s ease ${0.2 + i * 0.1}s forwards`,
                  opacity: 0
                }}>
                  <span style={{ color: "var(--accent)" }}>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form Side */}
          <div className="auth-side auth-side-form">
            <h2 style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.02em"
            }}>Welcome back</h2>
            <p className="muted" style={{ marginTop: "4px" }}>Sign in to access your dashboard and scan history.</p>

            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>

              <div className="auth-field">
                <label>Password</label>
                <div className="password-field-wrap">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                  <button type="button" className="btn btn-sm btn-outline password-toggle"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ display: "flex", alignItems: "center", padding: "4px 8px" }}>
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              <div className="auth-form-meta">
                <label className="remember-check">
                  <input type="checkbox" />
                  <span className="muted">Remember me</span>
                </label>
                <button type="button" className="link-like" onClick={handleReset}>Forgot password?</button>
              </div>

              <div className="auth-submit-row">
                <button type="submit" className="btn btn-primary" disabled={loading} style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}>
                  {loading ? 'Signing in...' : <><span>Sign in</span> <FiArrowRight size={16} /></>}
                </button>
              </div>

              {error && <div className="error auth-message" style={{ animation: "fadeInUp 0.3s ease" }}>{error}</div>}
              {info && <div className="info auth-message" style={{ animation: "fadeInUp 0.3s ease" }}>{info}</div>}
            </form>

            <div className="auth-footer-text">Don&apos;t have an account? <Link to="/signup">Create one</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}
