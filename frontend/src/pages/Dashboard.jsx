import React, { useState, useEffect, useRef } from "react";
import { FiImage, FiAlertTriangle, FiCheckCircle, FiPercent, FiClock, FiArrowRight, FiActivity, FiZap } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// Animated counter hook
function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const step = Math.max(1, Math.ceil(target / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

function Dashboard({ history, user }) {
  const navigate = useNavigate();

  const total = history.length;
  const defects = history.filter((h) => h.label === "defective").length;
  const passed = total - defects;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";

  const animTotal = useCountUp(total);
  const animDefects = useCountUp(defects);
  const animPassed = useCountUp(passed);

  const pieData = total > 0
    ? [
        { name: "Defective", value: defects },
        { name: "Passed", value: passed },
      ]
    : [{ name: "No Data", value: 1 }];

  const PIE_COLORS = total > 0 ? ["#ffb4ab", "#10B981"] : ["#181c24"];

  const recent = [...history].reverse().slice(0, 5);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="fade-in dashboard-page">
      <div className="dashboard-content">
        {/* Welcome Banner */}
        <div className="welcome-banner fade-in-up" style={{
          background: "linear-gradient(135deg, rgba(192, 193, 255, 0.08), rgba(208, 188, 255, 0.04))",
          border: "1px solid rgba(192, 193, 255, 0.15)",
          borderRadius: "var(--radius)",
          padding: "36px 40px",
          marginBottom: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          backdropFilter: "blur(24px)"
        }}>
          <div>
            <h2 style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: "clamp(1.6rem, 1.2rem + 1vw, 2.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--text-primary)",
              margin: 0
            }}>
              {greeting()}{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ""} 👋
            </h2>
            <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "15px" }}>
              Monitor fabric quality, review scan outcomes, and act quickly.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              padding: "8px 16px",
              borderRadius: "999px",
              background: "var(--success-light)",
              color: "var(--success)",
              fontSize: "12px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              letterSpacing: "0.02em"
            }}>
              <FiActivity size={14} /> System Online
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: "24px" }}>
          <div className="stat-card fade-in-up stagger-1">
            <div className="stat-icon blue"><FiImage /></div>
            <div className="stat-info">
              <h4>{animTotal}</h4>
              <p>Total Scanned</p>
            </div>
          </div>
          <div className="stat-card fade-in-up stagger-2">
            <div className="stat-icon red"><FiAlertTriangle /></div>
            <div className="stat-info">
              <h4>{animDefects}</h4>
              <p>Defects Found</p>
            </div>
          </div>
          <div className="stat-card fade-in-up stagger-3">
            <div className="stat-icon green"><FiCheckCircle /></div>
            <div className="stat-info">
              <h4>{animPassed}</h4>
              <p>Passed</p>
            </div>
          </div>
          <div className="stat-card fade-in-up stagger-4">
            <div className="stat-icon purple"><FiPercent /></div>
            <div className="stat-info">
              <h4>{passRate}%</h4>
              <p>Pass Rate</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px" }}>
          {/* Recent Predictions */}
          <div className="card fade-in-up stagger-5">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <FiClock style={{ color: "var(--accent)" }} /> Recent Predictions
              </h3>
              {history.length > 0 && (
                <button className="btn btn-outline btn-sm" onClick={() => navigate("/analytics")}>
                  View All <FiArrowRight size={12} />
                </button>
              )}
            </div>
            {recent.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--text-muted)"
              }}>
                <FiImage size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <p style={{ fontSize: "14px" }}>No predictions yet</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: "16px" }}
                  onClick={() => navigate("/detect")}
                >
                  Start Scanning <FiArrowRight />
                </button>
              </div>
            ) : (
              <div className="history-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>File</th>
                      <th>Result</th>
                      <th>Confidence</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((item, i) => (
                      <tr key={i} style={{ animationDelay: `${i * 0.05}s` }}>
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
                        <td style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "13px" }}>
                          {item.confidence}%
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Pie Chart */}
            <div className="card fade-in-up stagger-5">
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 8px 0"
              }}>Defect Distribution</h3>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    strokeWidth={0}
                    animationBegin={200}
                    animationDuration={1000}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  {total > 0 && <Tooltip
                    contentStyle={{
                      background: 'rgba(24,24,36,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#F5F5F7',
                      backdropFilter: 'blur(12px)'
                    }}
                  />}
                </PieChart>
              </ResponsiveContainer>
              {total > 0 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffb4ab", display: "inline-block" }} />
                    Defective ({defects})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                    Passed ({passed})
                  </span>
                </div>
              )}
            </div>

            {/* Quick Start */}
            <div className="card fade-in-up stagger-6" style={{
              background: "linear-gradient(135deg, rgba(192, 193, 255, 0.04), var(--bg-card))",
              border: "1px solid rgba(192, 193, 255, 0.12)",
              textAlign: "center",
              padding: "40px 24px"
            }}>
              <FiZap size={32} style={{ color: "var(--primary)", margin: "0 auto 16px auto", filter: "drop-shadow(0 0 12px rgba(192,193,255,0.4))" }} />
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: "0 0 8px 0"
              }}>Quick Scan</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "16px", lineHeight: "1.5" }}>
                Upload a fabric image or use your camera to instantly detect defects.
              </p>
              <button
                className="btn btn-primary"
                style={{ padding: "12px 28px", fontSize: "14px" }}
                onClick={() => navigate("/detect")}
              >
                Start Detection <FiArrowRight style={{ marginLeft: "6px" }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
