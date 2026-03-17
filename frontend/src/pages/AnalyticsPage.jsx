import React from "react";
import { FiDownload, FiTrendingUp, FiTrash2, FiBarChart2, FiAlertTriangle, FiCheckCircle, FiActivity, FiTarget, FiUpload, FiCamera, FiCpu } from "react-icons/fi";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from "recharts";

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(24,24,36,0.95)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#F5F5F7',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
  }
};

function AnalyticsPage({ history, onClearHistory }) {
  const normalizedHistory = history.map((item, index) => ({
    ...item,
    index: index + 1,
    confidence: Number(item.confidence || 0),
    defect_probability: Number(item.defect_probability || 0),
    label: item.label || "unknown",
    source: item.source || "upload",
    pipeline: item.pipeline || "cnn_cv_hybrid",
  }));

  const total = normalizedHistory.length;
  const defects = normalizedHistory.filter((h) => h.label === "defective").length;
  const passed = total - defects;
  const defectRate = total > 0 ? ((defects / total) * 100).toFixed(1) : "0.0";

  const confidences = normalizedHistory.map((h) => h.confidence);
  const defectScores = normalizedHistory.map((h) => h.defect_probability);
  const avgConf = total > 0 ? (confidences.reduce((a, b) => a + b, 0) / total).toFixed(1) : "0.0";
  const avgDefect = total > 0 ? (defectScores.reduce((a, b) => a + b, 0) / total).toFixed(1) : "0.0";

  const highRiskCount = normalizedHistory.filter((h) => h.defect_probability >= 70).length;
  const uncertainCount = normalizedHistory.filter((h) => h.defect_probability >= 40 && h.defect_probability <= 60).length;
  const falseAlarmCandidates = normalizedHistory.filter((h) => h.label === "defective" && h.defect_probability < 50).length;

  const trendWindow = normalizedHistory.slice(-20);
  const trendData = trendWindow.map((h, i) => ({
    scan: i + 1,
    confidence: h.confidence,
    defect_probability: h.defect_probability,
  }));

  const pieData = total > 0
    ? [{ name: "Defective", value: defects }, { name: "Passed", value: passed }]
    : [{ name: "No Data", value: 1 }];
  const PIE_COLORS = total > 0 ? ["#EF4444", "#10B981"] : ["#181824"];

  const sourceCounts = normalizedHistory.reduce(
    (acc, item) => {
      if (item.source === "camera") acc.camera += 1;
      else acc.upload += 1;
      return acc;
    },
    { upload: 0, camera: 0 }
  );

  const sourceData = [
    { source: "Upload", count: sourceCounts.upload },
    { source: "Camera", count: sourceCounts.camera },
  ];

  const confidenceBands = [
    { range: "0-50", count: 0 },
    { range: "50-70", count: 0 },
    { range: "70-85", count: 0 },
    { range: "85-100", count: 0 },
  ];

  normalizedHistory.forEach((item) => {
    const c = item.confidence;
    if (c < 50) confidenceBands[0].count += 1;
    else if (c < 70) confidenceBands[1].count += 1;
    else if (c < 85) confidenceBands[2].count += 1;
    else confidenceBands[3].count += 1;
  });

  const exportCSV = () => {
    if (normalizedHistory.length === 0) return;
    const header = "Filename,Label,Confidence,Defect Probability,Source,Pipeline,CNN Defect Probability,CV Defect Probability,Time\n";
    const rows = normalizedHistory
      .map(
        (h) =>
          `${h.filename || "image"},${h.label},${h.confidence},${h.defect_probability},${h.source || "upload"},${h.pipeline || "cnn_cv_hybrid"},${h.cnn_defect_probability ?? ""},${h.cv_defect_probability ?? ""},${h.time}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "defect_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const summaryItems = [
    { icon: <FiBarChart2 />, value: total, label: "Total Scans", color: "var(--accent)" },
    { icon: <FiAlertTriangle />, value: `${defectRate}%`, label: "Defect Rate", color: "var(--danger)" },
    { icon: <FiTarget />, value: highRiskCount, label: "High Risk (≥70%)", color: "var(--warning)" },
    { icon: <FiActivity />, value: `${avgConf}%`, label: "Avg Confidence", color: "var(--success)" },
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
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
            <FiTrendingUp style={{ color: "var(--accent)" }} /> Analytics
          </h2>
          <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "15px" }}>
            Quality insights and defect session analysis
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={total === 0} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FiDownload size={14} /> Export CSV
          </button>
          {total > 0 && (
            <button className="btn btn-danger btn-sm" onClick={onClearHistory} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FiTrash2 size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        {summaryItems.map((item, i) => (
          <div key={i} className={`stat-card fade-in-up stagger-${i + 1}`}>
            <div style={{
              width: "42px",
              height: "42px",
              borderRadius: "var(--radius-sm)",
              background: `${item.color}15`,
              color: item.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              flexShrink: 0
            }}>
              {item.icon}
            </div>
            <div className="stat-info">
              <h4>{item.value}</h4>
              <p>{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="card" style={{
          textAlign: "center",
          padding: "56px 24px",
          background: "linear-gradient(135deg, rgba(22,22,34,0.65), rgba(22,22,34,0.4))"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "var(--accent-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            color: "var(--accent)",
            fontSize: "24px"
          }}>
            <FiTrendingUp />
          </div>
          <h3 style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 8px 0"
          }}>No Data Yet</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            Run some predictions to see analytics here
          </p>
        </div>
      ) : (
        <>
          {/* Charts Row 1 */}
          <div className="charts-grid" style={{ marginBottom: "20px" }}>
            <div className="chart-card fade-in-up stagger-3">
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0"
              }}>Recent Trend (Last 20 scans)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5A623" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="scan" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="defect_probability" stroke="#EF4444" fill="url(#gradRed)" strokeWidth={2} name="Defect Prob." />
                  <Area type="monotone" dataKey="confidence" stroke="#F5A623" fill="url(#gradGold)" strokeWidth={2} name="Confidence" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card fade-in-up stagger-4">
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0"
              }}>Classification Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" strokeWidth={0}
                    animationBegin={300} animationDuration={1000}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="charts-grid" style={{ marginBottom: "20px" }}>
            <div className="chart-card fade-in-up stagger-5">
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0"
              }}>Source Usage</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceData}>
                  <defs>
                    <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="source" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="url(#gradPurple)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card fade-in-up stagger-6">
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0"
              }}>Confidence Quality Bands</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={confidenceBands}>
                  <defs>
                    <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F5A623" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#E09000" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="url(#gradAmber)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Insights Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { label: "Defective scans", value: defects, icon: <FiAlertTriangle /> },
              { label: "Passed scans", value: passed, icon: <FiCheckCircle /> },
              { label: "False alarm candidates", value: falseAlarmCandidates, icon: <FiTarget /> },
              { label: "Primary pipeline", value: normalizedHistory[normalizedHistory.length - 1]?.pipeline || "n/a", icon: <FiCpu /> }
            ].map((item, i) => (
              <div key={i} className="analytics-insight-item fade-in-up" style={{ animationDelay: `${0.35 + i * 0.05}s` }}>
                <span className="label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {item.icon} {item.label}
                </span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {/* Full History Table */}
          <div className="card fade-in-up" style={{ animationDelay: "0.4s" }}>
            <div className="card-header" style={{ marginBottom: "16px" }}>
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0
              }}>All Predictions ({total})</h3>
            </div>
            <div className="history-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Image</th>
                    <th>Filename</th>
                    <th>Result</th>
                    <th>Confidence</th>
                    <th>Defect Prob.</th>
                    <th>Source</th>
                    <th>Pipeline</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...normalizedHistory].reverse().map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "12px", color: "var(--text-muted)" }}>{total - i}</td>
                      <td>
                        {item.preview ? (
                          <img src={item.preview} alt="" className="history-thumb" />
                        ) : (
                          <div className="history-thumb" style={{ background: "var(--bg-tertiary)" }} />
                        )}
                      </td>
                      <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.filename || "image"}
                      </td>
                      <td>
                        <span className={`history-badge ${item.label === "defective" ? "defective" : "ok"}`}>
                          {item.label === "defective" ? "Defective" : "Passed"}
                        </span>
                      </td>
                      <td style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "13px" }}>{item.confidence}%</td>
                      <td style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "13px", color: item.defect_probability > 50 ? "var(--danger)" : "var(--success)" }}>{item.defect_probability}%</td>
                      <td style={{ fontSize: "12px" }}>{item.source || "upload"}</td>
                      <td style={{ fontSize: "12px", fontFamily: '"JetBrains Mono", monospace' }}>{item.pipeline || "cnn_cv_hybrid"}</td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyticsPage;
