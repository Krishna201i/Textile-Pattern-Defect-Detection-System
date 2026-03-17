import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../authService';
import { FiShield, FiBarChart2, FiLock, FiEye, FiEyeOff, FiArrowRight, FiCheckCircle } from 'react-icons/fi';

export default function SignupPage({ onSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    <div className="auth-page modern auth-page-pro fade-in">
      <div className="auth-card modern-card auth-card-pro" style={{
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(167,139,250,0.04)"
      }}>
        <div className="auth-split">
          {/* Left: Brand / Hero Side (Purple variant for Signup) */}
          <div className="auth-side auth-side-illustration auth-side-pro" style={{
            background: "linear-gradient(145deg, rgba(26,26,36,0.7), rgba(167,139,250,0.04))",
            position: "relative",
            overflow: "hidden"
          }}>
            {/* Decorative glow orb */}
            <div style={{
              position: "absolute",
              top: "-60px",
              left: "-60px",
              width: "250px",
              height: "250px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.1), transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none"
            }} />

            <div className="brand auth-brand-pro" style={{ position: "relative", zIndex: 1 }}>
              <p className="auth-eyebrow" style={{ letterSpacing: "2px", color: "var(--purple)" }}>Start Your Journey</p>
              <h3 className="auth-brand-title" style={{
                fontSize: "32px",
                background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>Create Workspace</h3>
              <p style={{ lineHeight: "1.6", marginTop: "10px" }}>Set up secure access to quality analytics and team workflows.</p>
            </div>

            <div style={{
              marginTop: "28px",
              display: "grid",
              gap: "12px",
              position: "relative",
              zIndex: 1
            }}>
              {[
                { icon: <FiCheckCircle size={16} />, text: "Automated defect tracking" },
                { icon: <FiBarChart2 size={16} />, text: "Real-time quality insights" },
                { icon: <FiLock size={16} />, text: "Enterprise-grade security" }
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(167,139,250,0.04)",
                  border: "1px solid rgba(167,139,250,0.06)",
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  animation: `fadeInUp 0.4s ease ${0.2 + i * 0.1}s forwards`,
                  opacity: 0
                }}>
                  <span style={{ color: "var(--purple)" }}>{item.icon}</span>
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
            }}>Create account</h2>
            <p className="muted" style={{ marginTop: "4px" }}>Start saving scans and viewing analytics.</p>

            <form onSubmit={handleSubmit} style={{ marginTop: "24px" }}>
              <div className="auth-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>

              <div className="auth-field">
                <label>Password</label>
                <div className="password-field-wrap">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Choose a strong password" />
                  <button type="button" className="btn btn-sm btn-outline password-toggle"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ display: "flex", alignItems: "center", padding: "4px 8px" }}>
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label>Confirm password</label>
                <div className="password-field-wrap">
                  <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat password" />
                  <button type="button" className="btn btn-sm btn-outline password-toggle"
                    onClick={() => setShowConfirm(s => !s)}
                    style={{ display: "flex", alignItems: "center", padding: "4px 8px" }}>
                    {showConfirm ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              <div className="auth-submit-row" style={{ marginTop: "28px" }}>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: "linear-gradient(135deg, var(--purple), #5B21B6)",
                  boxShadow: "0 8px 20px rgba(124, 58, 237, 0.3)"
                }}>
                  {loading ? 'Creating account...' : <><span>Create account</span> <FiArrowRight size={16} /></>}
                </button>
              </div>

              {error && <div className="error auth-message" style={{ animation: "fadeInUp 0.3s ease" }}>{error}</div>}
            </form>

            <div className="auth-footer-text">
              Already have an account? <Link to="/login" style={{ color: "var(--purple)" }}>Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
