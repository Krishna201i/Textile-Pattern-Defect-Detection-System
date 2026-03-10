import React from "react";
import { FiDownload, FiTrendingUp } from "react-icons/fi";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from "recharts";

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
  const PIE_COLORS = total > 0 ? ["var(--danger)", "var(--success)"] : ["var(--text-muted)"];

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

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>Analytics</h2>
          <p>Textile defect session analysis and quality insights</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={total === 0}>
            <FiDownload /> Export CSV
          </button>
          {total > 0 && (
            <button className="btn btn-danger btn-sm" onClick={onClearHistory}>
              Clear Data
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="summary-grid">
        <div className="summary-item">
          <div className="value">{total}</div>
          <div className="label">Total Scans</div>
        </div>
        <div className="summary-item">
          <div className="value">{defectRate}%</div>
          <div className="label">Defect Rate</div>
        </div>
        <div className="summary-item">
          <div className="value">{highRiskCount}</div>
          <div className="label">High Risk (≥70%)</div>
        </div>
        <div className="summary-item">
          <div className="value">{uncertainCount}</div>
          <div className="label">Uncertain (40-60%)</div>
        </div>
        <div className="summary-item">
          <div className="value">{avgConf}%</div>
          <div className="label">Avg Confidence</div>
        </div>
        <div className="summary-item">
          <div className="value">{avgDefect}%</div>
          <div className="label">Avg Defect Probability</div>
        </div>
        <div className="summary-item">
          <div className="value">{sourceCounts.upload}</div>
          <div className="label">Upload Source</div>
        </div>
        <div className="summary-item">
          <div className="value">{sourceCounts.camera}</div>
          <div className="label">Camera Source</div>
        </div>
      </div>

      {total === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FiTrendingUp />
            <h3>No data yet</h3>
            <p>Run some predictions to see analytics here</p>
          </div>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="charts-grid">
            {/* Confidence Trend */}
            <div className="chart-card">
              <h3>Recent Trend (Last 20 scans)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scan" label={{ value: "Scan #", position: "insideBottom", offset: -5 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="defect_probability" stroke="var(--danger)" fill="var(--danger-light)" strokeWidth={2} />
                  <Line type="monotone" dataKey="confidence" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Distribution Pie */}
            <div className="chart-card">
              <h3>Classification Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <h3>Source Usage</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--purple)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>Confidence Quality Bands</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={confidenceBands}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card analytics-insight-row" style={{ marginBottom: "24px" }}>
            <div className="analytics-insight-item">
              <span className="label">Defective scans</span>
              <strong>{defects}</strong>
            </div>
            <div className="analytics-insight-item">
              <span className="label">Passed scans</span>
              <strong>{passed}</strong>
            </div>
            <div className="analytics-insight-item">
              <span className="label">False alarm candidates</span>
              <strong>{falseAlarmCandidates}</strong>
            </div>
            <div className="analytics-insight-item">
              <span className="label">Primary pipeline</span>
              <strong>{normalizedHistory[normalizedHistory.length - 1]?.pipeline || "n/a"}</strong>
            </div>
          </div>

          {/* Full History Table */}
          <div className="card">
            <div className="card-header">
              <h3>All Predictions ({total})</h3>
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
                      <td>{total - i}</td>
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
                      <td>{item.confidence}%</td>
                      <td>{item.defect_probability}%</td>
                      <td>{item.source || "upload"}</td>
                      <td>{item.pipeline || "cnn_cv_hybrid"}</td>
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
