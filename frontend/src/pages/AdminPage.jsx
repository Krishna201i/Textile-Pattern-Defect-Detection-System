import React, { useEffect, useState } from 'react';
import { db, storage } from '../firebaseClient';
import { FiDownload, FiTrash2, FiSearch, FiShield, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

export default function AdminPage() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [labelFilter, setLabelFilter] = useState('all');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadAllScans() {
      setLoading(true);
      try {
        const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
        const col = collection(db, 'scans');
        const q = query(col, orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        if (mounted) setScans(items);
      } catch (err) {
        if (mounted) setMessage({ type: 'error', text: 'Failed to load scans. Please retry.' });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAllScans();
    return () => { mounted = false; };
  }, []);

  const handleDelete = async (scan) => {
    if (!window.confirm(`Delete scan ${scan.id}? This cannot be undone.`)) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { ref: storageRef, deleteObject } = await import('firebase/storage');
      // delete storage image if present
      if (scan.owner && scan.id) {
        const fileRef = storageRef(storage, `scans/${scan.owner}/${scan.id}.jpg`);
        await deleteObject(fileRef).catch(() => {});
      }
      await deleteDoc(doc(db, 'scans', scan.id));
      // remove from local state
      setScans((prev) => prev.filter((s) => s.id !== scan.id));
      setMessage({ type: 'success', text: 'Scan deleted successfully.' });
    } catch (err) {
      console.error('Failed to delete scan', err);
      setMessage({ type: 'error', text: 'Failed to delete scan.' });
    }
  };

  const handleDownload = (scan) => {
    if (scan.image_url) {
      window.open(scan.image_url, '_blank');
    } else {
      setMessage({ type: 'error', text: 'No image available for this scan.' });
    }
  };

  const filteredScans = scans.filter((scan) => {
    const matchesQuery =
      !queryText ||
      scan.id?.toLowerCase().includes(queryText.toLowerCase()) ||
      scan.owner?.toLowerCase().includes(queryText.toLowerCase()) ||
      scan.filename?.toLowerCase().includes(queryText.toLowerCase());

    const matchesLabel = labelFilter === 'all' || scan.label === labelFilter;
    return matchesQuery && matchesLabel;
  });

  const defectiveCount = scans.filter((s) => s.label === 'defective').length;
  const passCount = scans.filter((s) => s.label === 'non_defective').length;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Admin Portal</h2>
        <p>Monitor user scans, review quality outcomes, and manage records.</p>
      </div>

      <div className="stats-grid admin-section-gap">
        <div className="stat-card">
          <div className="stat-icon blue"><FiShield /></div>
          <div className="stat-info">
            <h4>{scans.length}</h4>
            <p>Total Scans</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiAlertTriangle /></div>
          <div className="stat-info">
            <h4>{defectiveCount}</h4>
            <p>Defective</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><FiCheckCircle /></div>
          <div className="stat-info">
            <h4>{passCount}</h4>
            <p>Passed</p>
          </div>
        </div>
      </div>

      <div className="card admin-section-gap">
        <div className="admin-toolbar">
          <div className="admin-search">
            <FiSearch />
            <input
              type="text"
              placeholder="Search by scan ID, owner, filename"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
          </div>
          <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="admin-filter">
            <option value="all">All Labels</option>
            <option value="defective">Defective</option>
            <option value="non_defective">Passed</option>
          </select>
        </div>
      </div>

      {message && (
        <div className={`${message.type === 'error' ? 'error-card' : 'card'} admin-section-gap`}>
          {message.text}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="admin-loading-state">
            <div className="spinner" />
            <p className="loading-text">Loading scans...</p>
          </div>
        ) : filteredScans.length === 0 ? (
          <div className="empty-state">
            <FiShield />
            <h3>No matching scans</h3>
            <p>Try changing search text or filter options.</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Scan ID</th>
                <th>Owner</th>
                <th>Label</th>
                <th>Confidence</th>
                <th>Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredScans.map((s) => (
                <tr key={s.id}>
                  <td className="admin-id-cell">{s.id}</td>
                  <td>{s.owner || '-'}</td>
                  <td>
                    <span className={`result-badge ${s.label === 'defective' ? 'defective' : 'ok'}`}>
                      {s.label || 'unknown'}
                    </span>
                  </td>
                  <td>{Number(s.confidence || 0).toFixed(2)}%</td>
                  <td>{s.time || '-'}</td>
                  <td className="admin-actions">
                    <button className="btn btn-sm" onClick={() => handleDownload(s)}>
                      <FiDownload /> Open
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleDelete(s)}>
                      <FiTrash2 /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
