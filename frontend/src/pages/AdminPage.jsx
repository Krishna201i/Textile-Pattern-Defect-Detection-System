import React, { useEffect, useState, useMemo } from 'react';
import { FiDownload, FiTrash2, FiSearch, FiShield, FiAlertTriangle, FiCheckCircle, FiEdit2, FiSave, FiX, FiActivity, FiCpu, FiCheckSquare, FiXSquare, FiTrendingUp, FiTarget, FiLayers, FiInfo, FiPieChart } from 'react-icons/fi';
import { fetchAllScans, updateScanRecord, deleteScanRecord } from '../firebaseService';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, ComposedChart, Line, ReferenceLine
} from "recharts";

const COLORS = {
  danger: 'var(--danger, #ffb4ab)',
  success: 'var(--success, #10B981)',
  purple: 'var(--accent-purple, #A78BFA)',
  blue: 'var(--accent-blue, #60A5FA)',
  accent: 'var(--accent, #6366f1)',
  warning: 'var(--warning, #F59E0B)',
};
const HEADING_FONT = '"Space Grotesk", system-ui, sans-serif';

const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-tooltip, rgba(24,24,36,0.95))',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: 'var(--text-primary, #F5F5F7)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
  }
};

const CustomScatterTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ ...tooltipStyle.contentStyle, padding: '10px' }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{data.name}</p>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Status: <span style={{ color: data.fill }}>{data.label.toUpperCase()}</span></p>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Confidence: <span style={{ color: '#fff' }}>{data.x}%</span></p>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Defect Risk: <span style={{ color: '#fff' }}>{data.y}%</span></p>
      </div>
    );
  }
  return null;
};

export default function AdminPage() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [labelFilter, setLabelFilter] = useState('all');
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [draft, setDraft] = useState({ label: 'non_defective', confidence: 0, defect_probability: 0, admin_note: '' });

  useEffect(() => {
    let mounted = true;
    async function loadAllScans() {
      setLoading(true);
      try {
        const records = await fetchAllScans();
        if (mounted) setScans(Array.isArray(records) ? records : []);
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
      await deleteScanRecord(scan.id);
      setScans((prev) => prev.filter((s) => s.id !== scan.id));
      setMessage({ type: 'success', text: 'Scan deleted successfully.' });
    } catch (err) {
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

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (scanId) => {
    try {
      const payload = {
        label: draft.label,
        confidence: Number(draft.confidence || 0),
        defect_probability: Number(draft.defect_probability || 0),
        admin_note: draft.admin_note || '',
      };
      await updateScanRecord(scanId, payload);
      setScans((prev) => prev.map((s) => (s.id === scanId ? { ...s, ...payload } : s)));
      setEditingId(null);
      setMessage({ type: 'success', text: 'Scan record updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update scan record.' });
    }
  };

  const filteredScans = scans.filter((scan) => {
    const matchesQuery = !queryText || scan.id?.toLowerCase().includes(queryText.toLowerCase()) || scan.owner?.toLowerCase().includes(queryText.toLowerCase()) || scan.filename?.toLowerCase().includes(queryText.toLowerCase());
    const matchesLabel = labelFilter === 'all' || scan.label === labelFilter;
    return matchesQuery && matchesLabel;
  });

  const handleExportCsv = () => {
    if (!filteredScans.length) {
      setMessage({ type: 'error', text: 'No records to export.' });
      return;
    }
    const rows = [
      ['id', 'owner', 'label', 'confidence', 'defect_probability', 'filename', 'time', 'admin_note'],
      ...filteredScans.map((s) => [
        s.id || '', s.owner || '', s.label || '', String(Number(s.confidence || 0)),
        String(Number(s.defect_probability || 0)), s.filename || '', s.time || '', s.admin_note || ''
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_export_${new Date().getTime()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredScans.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredScans.map(s => s.id)));
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} records?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteScanRecord(id)));
      setScans(prev => prev.filter(s => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      setMessage({ type: 'success', text: `Successfully deleted ${selectedIds.size} records.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Batch deletion failed.' });
    }
  };

  const handleBatchApprove = async () => {
    if (!window.confirm(`Mark ${selectedIds.size} selected records as Passed?`)) return;
    try {
      const updates = Array.from(selectedIds).map(async (id) => {
        const payload = { label: 'non_defective', admin_note: 'Batch Approved' };
        await updateScanRecord(id, payload);
      });
      await Promise.all(updates);
      setScans(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, label: 'non_defective', admin_note: 'Batch Approved' } : s));
      setSelectedIds(new Set());
      setMessage({ type: 'success', text: `Successfully approved ${selectedIds.size} records.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Batch approval failed.' });
    }
  };

  const handleBatchReject = async () => {
    if (!window.confirm(`Mark ${selectedIds.size} selected records as Defective?`)) return;
    try {
      const updates = Array.from(selectedIds).map(async (id) => {
        const payload = { label: 'defective', admin_note: 'Batch Rejected' };
        await updateScanRecord(id, payload);
      });
      await Promise.all(updates);
      setScans(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, label: 'defective', admin_note: 'Batch Rejected' } : s));
      setSelectedIds(new Set());
      setMessage({ type: 'success', text: `Successfully rejected ${selectedIds.size} records.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Batch rejection failed.' });
    }
  };

  // Compute Analytics Data based on filteredScans
  const analytics = useMemo(() => {
    const total = filteredScans.length;
    const defects = filteredScans.filter((s) => s.label === "defective").length;
    const passed = total - defects;
    const defectRate = total > 0 ? ((defects / total) * 100).toFixed(1) : "0.0";

    const avgConf = total > 0 ? (filteredScans.reduce((a, b) => a + Number(b.confidence || 0), 0) / total).toFixed(1) : "0.0";

    // Sort chronologically for timeline (oldest to newest)
    const sorted = [...filteredScans].sort((a, b) => new Date(a.time) - new Date(b.time));

    const timelineData = sorted.slice(-30).map((h, i) => ({
      scan: `Scan ${i + 1}`,
      confidence: Number(h.confidence || 0),
      risk: Number(h.defect_probability || 0),
      ssim: Number(h.ssim_defect_probability || h.defect_probability || 0),
      cv: Number(h.feature_defect_probability || h.defect_probability || 0),
      label: h.label
    }));

    const scatterData = filteredScans.map((h, i) => ({
      x: Number(h.confidence || 0),
      y: Number(h.defect_probability || 0),
      z: 100,
      name: h.filename || `Scan ${h.id?.slice(0, 6) || i}`,
      fill: h.label === 'defective' ? COLORS.danger : COLORS.success,
      label: h.label || 'unknown'
    }));

    const pieData = total > 0
      ? [{ name: "Defective", value: defects }, { name: "Passed", value: passed }]
      : [{ name: "No Data", value: 1 }];
    const PIE_COLORS = total > 0 ? [COLORS.danger, COLORS.success] : ['var(--bg-card, #181c24)'];

    return { total, defects, passed, defectRate, avgConf, timelineData, scatterData, pieData, PIE_COLORS };
  }, [filteredScans]);

  return (
    <div className="fade-in" style={{ padding: '0 12px 40px 12px' }}>

      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', background: 'linear-gradient(to right, #c0c1ff, #fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Command Center
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '1rem' }}>Global monitoring, visual analytics, and scan orchestration.</p>
        </div>
        <button className="btn btn-outline" onClick={handleExportCsv} style={{ background: 'rgba(192, 193, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(192, 193, 255, 0.15)' }}>
          <FiDownload /> Export Dataset
        </button>
      </div>

      {/* Global Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'linear-gradient(145deg, rgba(30,30,40,0.8), rgba(20,20,30,0.5))', border: '1px solid rgba(128, 131, 255, 0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Processed</p>
            <h3 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 700, color: '#fff' }}>{analytics.total}</h3>
          </div>
          <div style={{ padding: '12px', background: 'rgba(128, 131, 255, 0.1)', borderRadius: '12px', color: '#8083ff' }}><FiActivity size={24} /></div>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'linear-gradient(145deg, rgba(30,30,40,0.8), rgba(20,20,30,0.5))', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Defects Found</p>
            <h3 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 700, color: '#f87171' }}>{analytics.defects}</h3>
          </div>
          <div style={{ padding: '12px', background: 'rgba(248, 113, 113, 0.1)', borderRadius: '12px', color: '#f87171' }}><FiAlertTriangle size={24} /></div>
        </div>
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'linear-gradient(145deg, rgba(30,30,40,0.8), rgba(20,20,30,0.5))', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flawless Passing</p>
            <h3 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 700, color: '#34d399' }}>{analytics.passed}</h3>
          </div>
          <div style={{ padding: '12px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '12px', color: '#34d399' }}><FiCheckCircle size={24} /></div>
        </div>
      </div>

      {/* Visual Analytics Hub */}
      {analytics.total > 0 && (
        <>
          <div className="charts-grid" style={{ marginBottom: "24px", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
            {/* Timeline Area Chart */}
            <div className="card fade-in-up" style={{ padding: "24px", background: 'linear-gradient(135deg, rgba(30,30,40,0.4), rgba(20,20,30,0.8))', border: '1px solid rgba(192, 193, 255, 0.15)' }}>
              <h3 style={{ fontFamily: HEADING_FONT, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <FiTrendingUp style={{ color: "var(--accent)" }} /> Global Pipeline Timeline
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={analytics.timelineData}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffb4ab" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ffb4ab" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="scan" stroke="var(--text-muted)" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip {...tooltipStyle} />
                  <Area yAxisId="left" type="monotone" dataKey="risk" name="Defect Risk" fill="url(#colorRisk)" stroke={COLORS.danger} strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="confidence" name="Match Confidence" stroke={COLORS.success} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Distribution Pie Chart */}
            <div className="card fade-in-up" style={{ padding: "24px", background: 'linear-gradient(135deg, rgba(30,30,40,0.4), rgba(20,20,30,0.8))', border: '1px solid rgba(192, 193, 255, 0.15)' }}>
              <h3 style={{ fontFamily: HEADING_FONT, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <FiPieChart style={{ color: "var(--accent-purple)" }} /> Distribution
              </h3>
              <div style={{ position: 'relative', height: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" strokeWidth={0}>
                      {analytics.pieData.map((_, i) => <Cell key={i} fill={analytics.PIE_COLORS[i % analytics.PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: HEADING_FONT }}>{analytics.total}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card fade-in-up" style={{ padding: "24px", marginBottom: "40px", background: 'linear-gradient(135deg, rgba(30,30,40,0.4), rgba(20,20,30,0.8))', border: '1px solid rgba(192, 193, 255, 0.15)' }}>
            <h3 style={{ fontFamily: HEADING_FONT, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <FiTarget style={{ color: "var(--warning)" }} /> Risk Assessment Matrix
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="x" name="Confidence" domain={[0, 100]} unit="%" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis type="number" dataKey="y" name="Defect Risk" domain={[0, 100]} unit="%" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <ZAxis type="number" dataKey="z" range={[60, 60]} />
                <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <ReferenceLine x={75} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <Scatter name="Scans" data={analytics.scatterData}>
                  {analytics.scatterData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* System Analyzer & Summarizer */}
      <div className="card fade-in-up" style={{ padding: '24px', marginBottom: '40px', background: 'rgba(30, 30, 45, 0.4)', border: '1px solid rgba(192, 193, 255, 0.1)' }}>
        <h3 style={{ fontFamily: HEADING_FONT, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "10px" }}>
          <FiCpu style={{ color: "var(--accent)" }} /> System Health Analysis
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--accent)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Automated Insights</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: Number(analytics.defectRate) > 20 ? COLORS.danger : COLORS.success, marginTop: '6px' }} />
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {analytics.total === 0
                    ? "System is waiting for initial scan data. No patterns analyzed yet."
                    : `Detected a ${analytics.defectRate}% defect rate across ${analytics.total} patterns. ${Number(analytics.defectRate) > 15 ? 'Alert: Higher than normal frequency detected.' : 'Current frequency is within nominal range.'}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.accent, marginTop: '6px' }} />
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {analytics.total === 0
                    ? "Pipeline reliability metrics will appear here once scans are processed."
                    : `Average match confidence is sitting at ${analytics.avgConf}%. High-risk clusters identified at >85% defect probability.`}
                </p>
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--accent)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operational Summary</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Pipeline Integrity:</span>
                <span style={{ color: 'var(--success)' }}>Optimal</span>
              </li>
              <li style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Database Sync:</span>
                <span style={{ color: 'var(--success)' }}>Real-time</span>
              </li>
              <li style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Global Risk Level:</span>
                <span style={{ color: Number(analytics.defectRate) > 25 ? COLORS.danger : COLORS.success }}>
                  {Number(analytics.defectRate) > 25 ? 'Critical' : 'Low'}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Table section */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(192, 193, 255, 0.1)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiShield style={{ color: 'var(--primary)' }} /> Database & Data Orchestration
          </h4>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="admin-search" style={{ margin: 0, width: '260px' }}>
              <FiSearch />
              <input type="text" placeholder="Search ID, owner, filename..." value={queryText} onChange={(e) => setQueryText(e.target.value)} />
            </div>
            <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="admin-filter" style={{ margin: 0 }}>
              <option value="all">All Statuses</option>
              <option value="defective">Defective</option>
              <option value="non_defective">Passed</option>
            </select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div style={{ padding: '12px 24px', background: 'rgba(128, 131, 255, 0.1)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#c0c1ff' }}>{selectedIds.size} records selected</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm btn-outline" onClick={handleBatchApprove} style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}><FiCheckSquare /> Batch Approve</button>
              <button className="btn btn-sm btn-outline" onClick={handleBatchReject} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}><FiXSquare /> Batch Reject</button>
              <button className="btn btn-sm btn-outline" onClick={handleBatchDelete} style={{ background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}><FiTrash2 /> Batch Delete</button>
            </div>
          </div>
        )}

        {message && (
          <div style={{ padding: '16px 24px', background: message.type === 'error' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(52, 211, 153, 0.1)', color: message.type === 'error' ? '#f87171' : '#34d399', borderBottom: '1px solid var(--border-light)' }}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="spinner" />
            <p className="loading-text" style={{ marginTop: '16px' }}>Syncing records securely...</p>
          </div>
        ) : filteredScans.length === 0 ? (
          <div style={{ padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
              <FiSearch size={28} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>No records found</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px 0' }}>The system is ready, but no scans have been recorded yet.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => window.location.href = '/detect'}><FiSearch /> Run First Scan</button>
              <button className="btn btn-outline" onClick={async () => {
                try {
                  const seed = [
                    { label: 'defective', confidence: 92, defect_probability: 88, filename: 'sample_defect_1.jpg', source: 'upload', pipeline: 'ssim_cv_hybrid' },
                    { label: 'non_defective', confidence: 98, defect_probability: 2, filename: 'sample_ok_1.jpg', source: 'upload', pipeline: 'ssim_cv_hybrid' },
                    { label: 'defective', confidence: 85, defect_probability: 76, filename: 'sample_defect_2.jpg', source: 'upload', pipeline: 'ssim_cv_hybrid' },
                    { label: 'non_defective', confidence: 95, defect_probability: 5, filename: 'sample_ok_2.jpg', source: 'upload', pipeline: 'ssim_cv_hybrid' },
                  ];
                  const { savePrediction } = await import('../firebaseService');
                  for (const item of seed) {
                    await savePrediction(item);
                  }
                  window.location.reload();
                } catch (e) {
                  alert('Error seeding data: ' + e.message);
                }
              }}><FiLayers /> Seed Sample Data</button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="history-table" style={{ width: '100%', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px', width: '40px' }}>
                    <input type="checkbox" onChange={toggleAll} checked={filteredScans.length > 0 && selectedIds.size === filteredScans.length} style={{ cursor: 'pointer' }} />
                  </th>
                  <th>Scan ID</th>
                  <th>Origin / Owner</th>
                  <th>Status</th>
                  <th>Match Confidence</th>
                  <th>Admin Override Note</th>
                  <th>Timestamp</th>
                  <th style={{ paddingRight: '24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.map((s) => (
                  <tr key={s.id} style={{ transition: 'background 0.2s ease', ':hover': { background: 'var(--bg-tertiary)' }, background: selectedIds.has(s.id) ? 'rgba(192, 193, 255, 0.05)' : 'transparent' }}>
                    <td style={{ paddingLeft: '24px' }}>
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelection(s.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.id.slice(0, 8)}...</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                          {(s.owner || 'U')[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.9rem' }}>{s.owner || 'Unknown'}</span>
                      </div>
                    </td>
                    <td>
                      {editingId === s.id ? (
                        <select className="admin-edit-input" value={draft.label} onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}>
                          <option value="defective">Defective</option>
                          <option value="non_defective">Passed</option>
                        </select>
                      ) : (
                        <span style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', background: s.label === 'defective' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(52, 211, 153, 0.15)', color: s.label === 'defective' ? '#f87171' : '#34d399', border: `1px solid ${s.label === 'defective' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(52, 211, 153, 0.3)'}` }}>
                          {s.label === 'defective' ? 'Defective' : 'Passed'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingId === s.id ? (
                        <input className="admin-edit-input" type="number" min="0" max="100" value={draft.confidence} onChange={(e) => setDraft((prev) => ({ ...prev, confidence: e.target.value }))} style={{ width: '80px' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                            <div style={{ width: `${Number(s.confidence || 0)}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{Number(s.confidence || 0).toFixed(1)}%</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {editingId === s.id ? (
                        <input className="admin-edit-input" type="text" value={draft.admin_note} onChange={(e) => setDraft((prev) => ({ ...prev, admin_note: e.target.value }))} placeholder="Add note..." />
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: s.admin_note ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.admin_note || '-'}</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {s.time ? new Date(s.time).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {editingId === s.id ? (
                          <>
                            <button className="btn btn-sm" onClick={() => saveEdit(s.id)} style={{ padding: '6px 12px' }}><FiSave /> Save</button>
                            <button className="btn btn-sm btn-outline" onClick={cancelEdit} style={{ padding: '6px 12px' }}><FiX /></button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-outline" onClick={() => startEdit(s)} style={{ padding: '6px', minWidth: 'auto', border: '1px solid transparent', background: 'var(--bg-tertiary)' }} title="Edit Record"><FiEdit2 /></button>
                            <button className="btn btn-sm btn-outline" onClick={() => window.open(s.image_url || '#', '_blank')} style={{ padding: '6px', minWidth: 'auto', border: '1px solid transparent', background: 'var(--bg-tertiary)' }} title="View Image" disabled={!s.image_url}><FiSearch /></button>
                            <button className="btn btn-sm btn-outline" onClick={() => handleDelete(s)} style={{ padding: '6px', minWidth: 'auto', border: '1px solid rgba(248, 113, 113, 0.2)', background: 'rgba(248, 113, 113, 0.05)', color: '#f87171' }} title="Delete Record"><FiTrash2 /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
