import React, { useEffect, useState } from 'react';
import { db, storage } from '../firebaseClient';

export default function AdminPage() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadAllScans() {
      setLoading(true);
      const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
      const col = collection(db, 'scans');
      const q = query(col, orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      if (mounted) setScans(items);
      setLoading(false);
    }
    loadAllScans();
    return () => { mounted = false; };
  }, []);

  const handleDelete = async (scan) => {
    if (!confirm(`Delete scan ${scan.id}? This cannot be undone.`)) return;
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
      alert('Scan deleted');
    } catch (err) {
      console.error('Failed to delete scan', err);
      alert('Failed to delete scan');
    }
  };

  const handleDownload = (scan) => {
    if (scan.image_url) {
      window.open(scan.image_url, '_blank');
    } else {
      alert('No image URL available for this scan');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Admin Dashboard</h2>
        <p>Overview of all scans</p>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 24 }}>Loading…</div>
        ) : (
          <table className="history-table">
            <thead>
              <tr><th>ID</th><th>Owner</th><th>Label</th><th>Confidence</th><th>Time</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {scans.map(s => (
                <tr key={s.id}>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.id}</td>
                  <td>{s.owner}</td>
                  <td>{s.label}</td>
                  <td>{s.confidence}</td>
                  <td>{s.time}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => handleDownload(s)}>Download</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleDelete(s)} style={{ marginLeft: 8 }}>Delete</button>
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
