import React from "react";
import { FiDownload, FiTrendingUp } from "react-icons/fi";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

function AnalyticsPage({ history, onClearHistory }) {
  const total = history.length;
  const defects = history.filter((h) => h.label === "defective").length;
  const passed = total - defects;

  const confidences = history.map((h) => h.confidence);
  const avgConf = total > 0 ? (confidences.reduce((a, b) => a + b, 0) / total).toFixed(1) : "0.0";
  const maxConf = total > 0 ? Math.max(...confidences).toFixed(1) : "0.0";
  const minConf = total > 0 ? Math.min(...confidences).toFixed(1) : "0.0";

  // Confidence trend data
  const trendData = history.map((h, i) => ({
    scan: i + 1,
    confidence: h.confidence,
    defect: h.defect_probability,
  }));

  // Pie data
  const pieData = total > 0
    ? [{ name: "Defective", value: defects }, { name: "Passed", value: passed }]
    : [{ name: "No Data", value: 1 }];
  const PIE_COLORS = total > 0 ? ["#ef4444", "#22c55e"] : ["#334155"];

  // Histogram: defect probability buckets
  const buckets = [
    { range: "0-20%", count: 0 },
    { range: "20-40%", count: 0 },
    { range: "40-60%", count: 0 },
    { range: "60-80%", count: 0 },
    { range: "80-100%", count: 0 },
  ];
  history.forEach((h) => {
    const p = h.defect_probability;
    if (p < 20) buckets[0].count++;
    else if (p < 40) buckets[1].count++;
    else if (p < 60) buckets[2].count++;
    else if (p < 80) buckets[3].count++;
    else buckets[4].count++;
  });

  const exportCSV = () => {
    if (history.length === 0) return;
    const header = "Filename,Label,Confidence,Defect Probability,Time\n";
    const rows = history
      .map((h) => `${h.filename || "image"},${h.label},${h.confidence},${h.defect_probability},${h.time}`)
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
          <p>Session statistics and data visualization</p>
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
          <div className="value">{avgConf}%</div>
          <div className="label">Avg Confidence</div>
        </div>
        <div className="summary-item">
          <div className="value">{maxConf}%</div>
          <div className="label">Best Confidence</div>
        </div>
        <div className="summary-item">
          <div className="value">{minConf}%</div>
          <div className="label">Lowest Confidence</div>
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
              <h3>Confidence Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scan" label={{ value: "Scan #", position: "insideBottom", offset: -5 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="confidence" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="defect" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                </LineChart>
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

          {/* Histogram */}
          <div className="chart-card" style={{ marginBottom: "24px" }}>
            <h3>Defect Probability Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={buckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((item, i) => (
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
