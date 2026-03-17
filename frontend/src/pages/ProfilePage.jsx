import React, { useMemo, useState, useEffect } from 'react';
import { FiUser, FiMail, FiShield, FiRefreshCw, FiLogOut, FiImage, FiAlertTriangle, FiCheckCircle, FiActivity } from 'react-icons/fi';
import { sendVerificationEmail, sendPasswordReset, signOut, updateUserProfile } from '../authService';

export default function ProfilePage({ user, history, onProfileUpdated }) {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [photoInputError, setPhotoInputError] = useState(null);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setPhotoURL(user?.photoURL || '');
  }, [user?.displayName, user?.photoURL]);

  const stats = useMemo(() => {
    const total = history.length;
    const defective = history.filter((item) => item.label === 'defective').length;
    const passed = total - defective;
    const avgConfidence = total
      ? (history.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / total).toFixed(1)
      : '0.0';
    return { total, defective, passed, avgConfidence };
  }, [history]);

  const runAction = async (name, action) => {
    setError(null);
    setMessage(null);
    setLoadingAction(name);
    try {
      await action();
      if (name === 'verify') {
        setMessage('Verification email sent. Please check your inbox.');
      } else if (name === 'reset') {
        setMessage('Password reset email sent.');
      }
    } catch (err) {
      setError(err?.message || 'Action failed. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPhotoInputError(null);

    const trimmedPhoto = (photoURL || '').trim();
    if (trimmedPhoto) {
      try {
        const parsed = new URL(trimmedPhoto);
        const protocol = parsed.protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
          setPhotoInputError('Photo URL must start with http:// or https://');
          return;
        }
      } catch {
        setPhotoInputError('Please enter a valid photo URL');
        return;
      }
    }

    setLoadingAction('save');
    try {
      const updatedUser = await updateUserProfile({ displayName, photoURL: trimmedPhoto });
      if (onProfileUpdated) onProfileUpdated(updatedUser);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRemovePhoto = async () => {
    setError(null);
    setMessage(null);
    setPhotoInputError(null);
    setLoadingAction('remove-photo');
    try {
      const updatedUser = await updateUserProfile({ displayName, photoURL: '' });
      setPhotoURL('');
      if (onProfileUpdated) onProfileUpdated(updatedUser);
      setMessage('Profile photo removed.');
    } catch (err) {
      setError(err?.message || 'Failed to remove profile photo.');
    } finally {
      setLoadingAction(null);
    }
  };

  const profileStats = [
    { icon: <FiImage />, value: stats.total, label: "Total Scans", color: "var(--accent)" },
    { icon: <FiAlertTriangle />, value: stats.defective, label: "Defective", color: "var(--danger)" },
    { icon: <FiCheckCircle />, value: stats.passed, label: "Passed", color: "var(--success)" },
    { icon: <FiActivity />, value: `${stats.avgConfidence}%`, label: "Avg Confidence", color: "var(--purple)" },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <h2 style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: "clamp(1.4rem, 1.1rem + 0.8vw, 2rem)",
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          margin: 0
        }}>
          <FiUser style={{ color: "var(--accent)" }} /> Profile
        </h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "15px" }}>
          Manage your account and view scan activity
        </p>
      </div>

      <div className="profile-grid">
        {/* Left: Account Details */}
        <div className="card fade-in-up">
          <h3 style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 20px 0",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <FiUser style={{ color: "var(--accent)" }} /> Account
          </h3>

          <form onSubmit={handleProfileSave} className="profile-edit-form">
            <div className="profile-avatar-row">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="profile-avatar" style={{
                  borderRadius: "50%",
                  border: "3px solid rgba(245,166,35,0.2)",
                  boxShadow: "0 0 20px rgba(245,166,35,0.1)"
                }} />
              ) : (
                <div className="profile-avatar profile-avatar-fallback" style={{
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(245,166,35,0.1), rgba(167,139,250,0.08))",
                  border: "3px solid rgba(245,166,35,0.15)",
                  fontSize: "28px",
                  color: "var(--accent)"
                }}>
                  <FiUser />
                </div>
              )}
              <div className="profile-edit-grid">
                <label>
                  Display Name
                  <input
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </label>
                <label>
                  Photo URL
                  <input
                    type="url"
                    placeholder="https://..."
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="profile-edit-actions" style={{ marginTop: "12px" }}>
              <button className="btn btn-primary btn-sm" type="submit" disabled={loadingAction === 'save'} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {loadingAction === 'save' ? 'Saving...' : '💾 Save profile'}
              </button>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={handleRemovePhoto}
                disabled={loadingAction === 'remove-photo' || !photoURL}
              >
                {loadingAction === 'remove-photo' ? 'Removing...' : 'Remove photo'}
              </button>
            </div>

            {photoInputError && <div className="error-card profile-message">{photoInputError}</div>}
          </form>

          {/* Info Grid */}
          <div className="info-grid" style={{ marginTop: "20px" }}>
            {[
              { label: "Email", value: user?.email || 'N/A', icon: <FiMail /> },
              { label: "Display Name", value: user?.displayName || 'Not set', icon: <FiUser /> },
              { label: "Email Status", value: user?.emailVerified ? 'Verified ✓' : 'Not Verified', icon: <FiShield /> },
              { label: "User ID", value: user?.uid || 'N/A', mono: true },
            ].map((item, i) => (
              <div key={i} className="info-item" style={{
                animation: `fadeInUp 0.3s ease ${0.1 + i * 0.05}s forwards`,
                opacity: 0
              }}>
                <div className="info-label">{item.label}</div>
                <div className="info-value profile-value" style={item.mono ? { fontFamily: '"JetBrains Mono", monospace', fontSize: "0.8rem" } : {}}>
                  {item.icon && <span style={{ color: "var(--accent)", marginRight: "4px" }}>{item.icon}</span>}
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Account Actions */}
          <div className="profile-actions" style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
            {!user?.emailVerified && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => runAction('verify', () => sendVerificationEmail(user))}
                disabled={loadingAction === 'verify'}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <FiMail size={14} /> {loadingAction === 'verify' ? 'Sending...' : 'Verify email'}
              </button>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => runAction('reset', () => sendPasswordReset(user?.email))}
              disabled={loadingAction === 'reset' || !user?.email}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <FiRefreshCw size={14} /> {loadingAction === 'reset' ? 'Sending...' : 'Reset password'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => signOut()} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FiLogOut size={14} /> Sign out
            </button>
          </div>

          {error && <div className="error-card profile-message" style={{ animation: "fadeInUp 0.3s ease" }}>{error}</div>}
          {message && <div className="card profile-message" style={{
            background: "var(--success-light)",
            color: "var(--success)",
            border: "1px solid rgba(16,185,129,0.2)",
            padding: "12px 16px",
            borderRadius: "var(--radius-sm)",
            fontSize: "14px",
            animation: "fadeInUp 0.3s ease"
          }}>{message}</div>}
        </div>

        {/* Right: Scan Summary */}
        <div className="card fade-in-up stagger-2">
          <h3 style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 20px 0",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <FiActivity style={{ color: "var(--purple)" }} /> Scan Summary
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {profileStats.map((stat, i) => (
              <div key={i} style={{
                padding: "18px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                textAlign: "center",
                animation: `fadeInUp 0.3s ease ${0.15 + i * 0.06}s forwards`,
                opacity: 0,
                transition: "all 0.25s ease"
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--border-glow)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: `${stat.color}15`,
                  color: stat.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 10px",
                  fontSize: "16px"
                }}>
                  {stat.icon}
                </div>
                <div style={{
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--text-primary)"
                }}>{stat.value}</div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
