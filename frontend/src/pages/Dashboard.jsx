import React from "react";
import { FiImage, FiAlertTriangle, FiCheckCircle, FiPercent, FiClock, FiArrowRight } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import MagicBento from "../components/MagicBento";

function Dashboard({ history }) {
  const navigate = useNavigate();

  const total = history.length;
  const defects = history.filter((h) => h.label === "defective").length;
  const passed = total - defects;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";

  const pieData = total > 0
    ? [
        { name: "Defective", value: defects },
        { name: "Passed", value: passed },
      ]
    : [{ name: "No Data", value: 1 }];

  const PIE_COLORS = total > 0 ? ["#ef4444", "#22c55e"] : ["#334155"];

  const recent = [...history].reverse().slice(0, 5);

  return (
    <div className="fade-in dashboard-page">
      <div className="dashboard-content">
        <div className="page-header" style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 className="portal-title">Operations Dashboard</h2>
          <p className="portal-subtitle">Monitor fabric quality, review scan outcomes, and act quickly.</p>
        </div>

        <MagicBento
          enableStars={false}
          enableSpotlight={false}
          enableBorderGlow={true}
          enableTilt={false}
          enableMagnetism={false}
          clickEffect={false}
          spotlightRadius={420}
          particleCount={0}
          glowColor="59, 130, 246"
          disableAnimations={false}
        >
          {/* Stat 1: Total Scanned */}
          <div className="bento-stat">
            <div className="stat-icon blue"><FiImage /></div>
            <div className="stat-info">
              <h4>{total}</h4>
              <p>Total Scanned</p>
            </div>
          </div>

          {/* Stat 2: Defects Found */}
          <div className="bento-stat">
            <div className="stat-icon red"><FiAlertTriangle /></div>
            <div className="stat-info">
              <h4>{defects}</h4>
              <p>Defects Found</p>
            </div>
          </div>

          {/* Stat 3: Passed */}
          <div className="bento-stat">
            <div className="stat-icon green"><FiCheckCircle /></div>
            <div className="stat-info">
              <h4>{passed}</h4>
              <p>Passed</p>
            </div>
          </div>

          {/* Stat 4: Pass Rate */}
          <div className="bento-stat">
            <div className="stat-icon purple"><FiPercent /></div>
            <div className="stat-info">
              <h4>{passRate}%</h4>
              <p>Pass Rate</p>
            </div>
          </div>

          {/* Quick Start */}
          <div className="bento-block">
            <h3>Quick Start</h3>
            <div className="bento-empty-state">
              <FiImage />
              <p>Upload a fabric image to start detecting defects</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: "16px" }}
                onClick={() => navigate("/detect")}
              >
                Go to Detect <FiArrowRight />
              </button>
            </div>
          </div>

          {/* Defect Distribution Pie Chart */}
          <div className="bento-block">
            <h3>Defect Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                {total > 0 && <Tooltip />}
              </PieChart>
            </ResponsiveContainer>
            {total > 0 && (
              <div className="bento-legend">
                <span className="bento-legend-item">
                  <span className="bento-legend-dot" style={{ background: "#ef4444" }} /> Defective ({defects})
                </span>
                <span className="bento-legend-item">
                  <span className="bento-legend-dot" style={{ background: "#22c55e" }} /> Passed ({passed})
                </span>
              </div>
            )}
          </div>

          {/* Recent Predictions */}
          <div className="bento-block">
            <div className="bento-block-header">
              <h3>Recent Predictions</h3>
              {history.length > 0 && (
                <button className="btn btn-outline btn-sm" onClick={() => navigate("/analytics")}>
                  View All
                </button>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="bento-empty-state">
                <FiClock />
                <h3>No predictions yet</h3>
                <p>Upload some images to start building your history</p>
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
                      <tr key={i}>
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
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </MagicBento>
      </div>
    </div>
  );
}

export default Dashboard;
