import React, { useEffect, useState } from 'react';
import { FiDownload, FiTrash2, FiSearch, FiShield, FiAlertTriangle, FiCheckCircle, FiEdit2, FiSave, FiX } from 'react-icons/fi';

export default function AdminPage() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [labelFilter, setLabelFilter] = useState('all');
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    label: 'non_defective',
    confidence: 0,
    defect_probability: 0,
    admin_note: '',
  });

  useEffect(() => {
    let mounted = true;
    async function loadAllScans() {
      setLoading(true);
      try {
        const recordsRes = await fetch('/api/admin/records');
        const summaryRes = await fetch('/api/admin/summary');

        if (!recordsRes.ok || !summaryRes.ok) {
          throw new Error('Admin API request failed');
        }

        const recordsJson = await recordsRes.json();
        const summaryJson = await summaryRes.json();

        if (mounted) {
          setScans(Array.isArray(recordsJson.records) ? recordsJson.records : []);
          if (summaryJson?.summary?.top_owner) {
            setMessage({
              type: 'info',
              text: `Top owner by volume: ${summaryJson.summary.top_owner.owner} (${summaryJson.summary.top_owner.count} scans)`,
            });
          }
        }
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
      const res = await fetch(`/api/admin/records/${scan.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      // remove from local state
      setScans((prev) => prev.filter((s) => s.id !== scan.id));
      setMessage({ type: 'success', text: 'Scan deleted successfully.' });
    } catch (err) {
      console.error('Failed to delete scan', err);
      setMessage({ type: 'error', text: 'Failed to delete scan.' });
    }
  };

  const startEdit = (scan) => {
    setEditingId(scan.id);
    setDraft({
      label: scan.label || 'non_defective',
      confidence: Number(scan.confidence || 0),
      defect_probability: Number(scan.defect_probability || 0),
      admin_note: scan.admin_note || '',
    });
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ label: 'non_defective', confidence: 0, defect_probability: 0, admin_note: '' });
  };

  const saveEdit = async (scanId) => {
    try {
      const payload = {
        label: draft.label,
        confidence: Number(draft.confidence || 0),
        defect_probability: Number(draft.defect_probability || 0),
        admin_note: draft.admin_note || '',
      };

      const res = await fetch(`/api/admin/records/${scanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Update failed');

      setScans((prev) => prev.map((s) => (s.id === scanId ? { ...s, ...payload } : s)));
      setEditingId(null);
      setMessage({ type: 'success', text: 'Scan record updated.' });
    } catch (err) {
      console.error('Failed to update scan', err);
      setMessage({ type: 'error', text: 'Failed to update scan record.' });
    }
  };

  const handleExportCsv = () => {
    if (!filteredScans.length) {
      setMessage({ type: 'error', text: 'No records to export.' });
      return;
    }

    const rows = [
      ['id', 'owner', 'label', 'confidence', 'defect_probability', 'filename', 'time', 'admin_note'],
      ...filteredScans.map((s) => [
        s.id || '',
        s.owner || '',
        s.label || '',
        String(Number(s.confidence || 0)),
        String(Number(s.defect_probability || 0)),
        s.filename || '',
        s.time || '',
        s.admin_note || '',
      ]),
    ];

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_scans_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
  const avgConfidence = scans.length
    ? (scans.reduce((sum, s) => sum + Number(s.confidence || 0), 0) / scans.length).toFixed(1)
    : '0.0';

  const ownerCounts = scans.reduce((acc, s) => {
    const owner = s.owner || 'unknown';
    acc[owner] = (acc[owner] || 0) + 1;
    return acc;
  }, {});
  const topOwner = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0];

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
        <div className="stat-card">
          <div className="stat-icon purple"><FiCheckCircle /></div>
          <div className="stat-info">
            <h4>{avgConfidence}%</h4>
            <p>Avg Confidence</p>
          </div>
        </div>
      </div>

      <div className="card admin-section-gap">
        <div className="admin-analytics-line">
          <span><strong>Top owner by volume:</strong> {topOwner ? `${topOwner[0]} (${topOwner[1]} scans)` : 'N/A'}</span>
          <button className="btn btn-sm btn-outline" onClick={handleExportCsv}>
            <FiDownload /> Export CSV
          </button>
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
                <th>Defect %</th>
                <th>Admin Note</th>
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
                    {editingId === s.id ? (
                      <select
                        className="admin-edit-input"
                        value={draft.label}
                        onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
                      >
                        <option value="defective">Defective</option>
                        <option value="non_defective">Passed</option>
                      </select>
                    ) : (
                      <span className={`result-badge ${s.label === 'defective' ? 'defective' : 'ok'}`}>
                        {s.label || 'unknown'}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === s.id ? (
                      <input
                        className="admin-edit-input"
                        type="number"
                        min="0"
                        max="100"
                        value={draft.confidence}
                        onChange={(e) => setDraft((prev) => ({ ...prev, confidence: e.target.value }))}
                      />
                    ) : (
                      `${Number(s.confidence || 0).toFixed(2)}%`
                    )}
                  </td>
                  <td>
                    {editingId === s.id ? (
                      <input
                        className="admin-edit-input"
                        type="number"
                        min="0"
                        max="100"
                        value={draft.defect_probability}
                        onChange={(e) => setDraft((prev) => ({ ...prev, defect_probability: e.target.value }))}
                      />
                    ) : (
                      `${Number(s.defect_probability || 0).toFixed(2)}%`
                    )}
                  </td>
                  <td>
                    {editingId === s.id ? (
                      <input
                        className="admin-edit-input"
                        type="text"
                        value={draft.admin_note}
                        onChange={(e) => setDraft((prev) => ({ ...prev, admin_note: e.target.value }))}
                        placeholder="Optional note"
                      />
                    ) : (
                      s.admin_note || '-'
                    )}
                  </td>
                  <td>{s.time || '-'}</td>
                  <td className="admin-actions">
                    {editingId === s.id ? (
                      <>
                        <button className="btn btn-sm" onClick={() => saveEdit(s.id)}>
                          <FiSave /> Save
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={cancelEdit}>
                          <FiX /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-sm" onClick={() => startEdit(s)}>
                          <FiEdit2 /> Edit
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => handleDownload(s)}>
                          <FiDownload /> Open
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => handleDelete(s)}>
                          <FiTrash2 /> Delete
                        </button>
                      </>
                    )}
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
