import React, { useMemo, useState, useEffect } from 'react';
import { FiUser, FiMail, FiShield, FiRefreshCw, FiLogOut } from 'react-icons/fi';
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

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Profile</h2>
        <p>Manage your account and view your scan activity summary.</p>
      </div>

      <div className="profile-grid">
        <div className="card">
          <div className="card-header">
            <h3><FiUser /> Account</h3>
          </div>

          <form onSubmit={handleProfileSave} className="profile-edit-form">
            <div className="profile-avatar-row">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="profile-avatar" />
              ) : (
                <div className="profile-avatar profile-avatar-fallback">
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

            <div className="profile-edit-actions">
              <button className="btn btn-primary btn-sm" type="submit" disabled={loadingAction === 'save'}>
                {loadingAction === 'save' ? 'Saving...' : 'Save profile'}
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

          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Email</div>
              <div className="info-value profile-value"><FiMail /> {user?.email || 'N/A'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Display Name</div>
              <div className="info-value profile-value">{user?.displayName || 'Not set'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Email Status</div>
              <div className="info-value profile-value">
                <FiShield /> {user?.emailVerified ? 'Verified' : 'Not Verified'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">User ID</div>
              <div className="info-value profile-value profile-mono">{user?.uid || 'N/A'}</div>
            </div>
          </div>

          <div className="profile-actions">
            {!user?.emailVerified && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => runAction('verify', () => sendVerificationEmail(user))}
                disabled={loadingAction === 'verify'}
              >
                <FiMail /> {loadingAction === 'verify' ? 'Sending...' : 'Send verification'}
              </button>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => runAction('reset', () => sendPasswordReset(user?.email))}
              disabled={loadingAction === 'reset' || !user?.email}
            >
              <FiRefreshCw /> {loadingAction === 'reset' ? 'Sending...' : 'Reset password'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => signOut()}>
              <FiLogOut /> Sign out
            </button>
          </div>

          {error && <div className="error-card profile-message">{error}</div>}
          {message && <div className="card profile-message">{message}</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Scan Summary</h3>
          </div>

          <div className="stats-grid profile-stats-grid">
            <div className="stat-card">
              <div className="stat-info">
                <h4>{stats.total}</h4>
                <p>Total Scans</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <h4>{stats.defective}</h4>
                <p>Defective</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <h4>{stats.passed}</h4>
                <p>Passed</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <h4>{stats.avgConfidence}%</h4>
                <p>Avg Confidence</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
