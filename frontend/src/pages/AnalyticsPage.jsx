import React, { useMemo } from "react";
import { FiDownload, FiTrendingUp, FiTrash2, FiBarChart2, FiAlertTriangle, FiCheckCircle, FiActivity, FiTarget, FiCpu, FiInfo, FiLayers } from "react-icons/fi";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, ComposedChart, Line, Bar, ReferenceLine
} from "recharts";

// ── Design tokens (avoids scattering hex literals across JSX) ──
const COLORS = {
  danger:  'var(--danger, #ffb4ab)',
  success: 'var(--success, #10B981)',
  purple:  'var(--accent-purple, #A78BFA)',
  blue:    'var(--accent-blue, #60A5FA)',
  accent:  'var(--accent, #6366f1)',
  warning: 'var(--warning, #F59E0B)',
};
const HEADING_FONT = '"Space Grotesk", system-ui, sans-serif';
const MONO_FONT   = '"JetBrains Mono", monospace';

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

function AnalyticsPage({ history, onClearHistory }) {
  const analyticsData = useMemo(() => {
    const rawHistory = history || [];
    const normalized = rawHistory.map((item, index) => ({
      ...item,
      index: index + 1,
      confidence: Number(item.confidence || 0),
      defect_probability: Number(item.defect_probability || 0),
      cnn_defect_probability: Number(item.cnn_defect_probability || item.defect_probability || 0),
      cv_defect_probability: Number(item.cv_defect_probability || item.defect_probability || 0),
      label: item.label || "unknown",
      source: item.source || "upload",
      pipeline: item.pipeline || "cnn_cv_hybrid",
      time: item.time || new Date().toLocaleString(),
    }));

    const total = normalized.length;
    const defects = normalized.filter((h) => h.label === "defective").length;
    const passed = total - defects;
    const defectRate = total > 0 ? ((defects / total) * 100).toFixed(1) : "0.0";

    const avgConf = total > 0 ? (normalized.reduce((a, b) => a + b.confidence, 0) / total).toFixed(1) : "0.0";
    const avgDefect = total > 0 ? (normalized.reduce((a, b) => a + b.defect_probability, 0) / total).toFixed(1) : "0.0";

    const highRiskCount = normalized.filter((h) => h.defect_probability >= 70).length;
    const borderlineCount = normalized.filter((h) => h.defect_probability >= 40 && h.defect_probability <= 60).length;
    const falseAlarmCandidates = normalized.filter((h) => h.label === "defective" && h.defect_probability < 50).length;

    // Timeline Data (Last 30)
    const timelineData = normalized.slice(-30).map((h, i) => ({
      scan: `Scan ${h.index}`,
      confidence: h.confidence,
      risk: h.defect_probability,
      cnn: h.cnn_defect_probability,
      cv: h.cv_defect_probability,
      label: h.label
    }));

    // Scatter Data for Risk Matrix
    const scatterData = normalized.map(h => ({
      x: h.confidence,
      y: h.defect_probability,
      z: 100, // Dot size
      name: h.filename || `Scan ${h.index}`,
      fill: h.label === 'defective' ? COLORS.danger : COLORS.success,
      label: h.label
    }));

    const pieData = total > 0
      ? [{ name: "Defective", value: defects }, { name: "Passed", value: passed }]
      : [{ name: "No Data", value: 1 }];
    const PIE_COLORS = total > 0 ? [COLORS.danger, COLORS.success] : ['var(--bg-card, #181c24)'];

    // Generate Dynamic Insights
    const insights = [];
    if (total === 0) {
      insights.push("No scan data available to analyze.");
    } else {
      if (Number(defectRate) > 20) {
        insights.push(`⚠️ High defect rate detected (${defectRate}%). Consider reviewing production batches.`);
      } else {
        insights.push(`✅ Production quality is stable with a ${(100 - Number(defectRate)).toFixed(1)}% pass rate.`);
      }

      if (borderlineCount > 0) {
        insights.push(`🔍 Found ${borderlineCount} borderline cases (40-60% risk). These might require manual human verification.`);
      }

      const avgCnn = (normalized.reduce((a, b) => a + b.cnn_defect_probability, 0) / total) || 0;
      const avgCv = (normalized.reduce((a, b) => a + b.cv_defect_probability, 0) / total) || 0;
      if (Math.abs(avgCnn - avgCv) > 20) {
        insights.push(`⚙️ The Neural Network and Structural Vision models show diverging assessments. Structural variance is likely high.`);
      } else {
        insights.push(`🤖 Neural and Structural models are highly aligned in their defect assessments.`);
      }
      
      if (Number(avgConf) > 85) {
        insights.push(`🎯 The AI is operating with high overall confidence (${avgConf}%).`);
      }
    }

    return {
      normalized, total, defects, passed, defectRate, avgConf, avgDefect,
      highRiskCount, borderlineCount, falseAlarmCandidates,
      timelineData, scatterData, pieData, PIE_COLORS, insights
    };
  }, [history]);

  const exportCSV = () => {
    if (analyticsData.normalized.length === 0) return;
    const header = "Filename,Label,Confidence,Defect Probability,Source,Pipeline,CNN Probability,CV Probability,Time\n";
    const rows = analyticsData.normalized
      .map(
        (h) =>
          `"${h.filename || "image"}","${h.label}",${h.confidence},${h.defect_probability},"${h.source || "upload"}","${h.pipeline || "cnn_cv_hybrid"}",${h.cnn_defect_probability},${h.cv_defect_probability},"${h.time}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "textileguard_analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  const summaryItems = [
    { icon: <FiBarChart2 />, value: analyticsData.total, label: "Total Scans", color: "var(--accent)" },
    { icon: <FiAlertTriangle />, value: `${analyticsData.defectRate}%`, label: "Defect Rate", color: "var(--danger)" },
    { icon: <FiTarget />, value: analyticsData.highRiskCount, label: "High Risk (≥70%)", color: "var(--warning)" },
    { icon: <FiActivity />, value: `${analyticsData.avgConf}%`, label: "Avg Confidence", color: "var(--success)" },
  ];

  return (
    <div className="fade-in" style={{ paddingBottom: "40px" }}>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h2 style={{
            fontFamily: HEADING_FONT,
            fontSize: "clamp(1.4rem, 1.1rem + 0.8vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: 0
          }}>
            <FiTrendingUp style={{ color: "var(--accent)" }} /> Command Center Analytics
          </h2>
          <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "15px" }}>
            Deep diagnostic metrics and model performance insights
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={analyticsData.total === 0} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FiDownload size={14} /> Export CSV
          </button>
          {analyticsData.total > 0 && (
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

      {analyticsData.total === 0 ? (
        <div className="card" style={{
          textAlign: "center",
          padding: "56px 24px",
          background: "linear-gradient(135deg, rgba(192, 193, 255, 0.04), var(--bg-card))",
          border: "1px solid var(--border-light)"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "var(--bg-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            color: "var(--text-muted)",
            fontSize: "24px"
          }}>
            <FiTrendingUp />
          </div>
          <h3 style={{
            fontFamily: HEADING_FONT,
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 8px 0"
          }}>Insufficient Data Context</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            Execute image scans in the Detect module to populate the analytics engine.
          </p>
        </div>
      ) : (
        <>
          {/* Dynamic Insights Box */}
          <div className="card fade-in-up stagger-2" style={{ 
            marginBottom: "24px", 
            borderLeft: "4px solid var(--accent)",
            background: "linear-gradient(90deg, rgba(99,102,241,0.1) 0%, rgba(24,24,36,0) 100%)"
          }}>
            <div style={{ padding: "20px" }}>
              <h3 style={{
                fontFamily: HEADING_FONT,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <FiInfo style={{ color: "var(--accent)" }} /> AI Diagnostic Insights
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {analyticsData.insights.map((insight, idx) => (
                  <div key={idx} style={{ 
                    fontSize: "14px", 
                    color: "var(--text-secondary)", 
                    lineHeight: 1.5,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px"
                  }}>
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 1: Timeline & Scatter */}
          <div className="charts-grid" style={{ marginBottom: "20px", gridTemplateColumns: "2fr 1fr" }}>
            <div className="chart-card fade-in-up stagger-3">
              <h3 style={{
                fontFamily: HEADING_FONT,
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0",
                display: "flex", alignItems: "center", gap: "8px"
              }}>
                <FiActivity style={{ color: "var(--accent)" }} /> AI Confidence Timeline
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>
                Tracking model confidence vs. defect risk across the last 30 scans.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={analyticsData.timelineData}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffb4ab" stopOpacity={0.4}/>{/* SVG gradient: CSS vars unsupported, fallback hex kept */}
                      <stop offset="95%" stopColor="#ffb4ab" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="scan" stroke="var(--text-muted)" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                  <Tooltip {...tooltipStyle} />
                  <Area yAxisId="left" type="monotone" dataKey="risk" name="Defect Risk" fill="url(#colorRisk)" stroke={COLORS.danger} strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="confidence" name="Model Confidence" stroke={COLORS.success} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card fade-in-up stagger-4">
              <h3 style={{
                fontFamily: HEADING_FONT,
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0",
                display: "flex", alignItems: "center", gap: "8px"
              }}>
                <FiTarget style={{ color: "var(--warning)" }} /> Risk Analysis Matrix
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>
                Clustering scans by output confidence (X) and defect probability (Y).
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" dataKey="x" name="Confidence" domain={[0, 100]} unit="%" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis type="number" dataKey="y" name="Defect Risk" domain={[0, 100]} unit="%" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <ZAxis type="number" dataKey="z" range={[60, 60]} />
                  <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <ReferenceLine x={75} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                  <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                  <Scatter name="Scans" data={analyticsData.scatterData}>
                    {
                      analyticsData.scatterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))
                    }
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2: Pipeline Comparison & Dist */}
          <div className="charts-grid" style={{ marginBottom: "20px", gridTemplateColumns: "1fr 1fr" }}>
             <div className="chart-card fade-in-up stagger-5">
              <h3 style={{
                fontFamily: HEADING_FONT,
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0",
                display: "flex", alignItems: "center", gap: "8px"
              }}>
                <FiLayers style={{ color: COLORS.purple }} /> Pipeline Inference Comparison
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>
                Comparing the Neural Network (CNN) vs. Structural Vision (CV) defect assessments over time.
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analyticsData.timelineData}>
                  <defs>
                    <linearGradient id="colorCnn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.8}/>{/* SVG gradient: hex fallback */}
                      <stop offset="95%" stopColor="#A78BFA" stopOpacity={0.1}/>{/* SVG gradient: hex fallback */}
                    </linearGradient>
                    <linearGradient id="colorCv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.5}/>{/* SVG gradient: hex fallback */}
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.1}/>{/* SVG gradient: hex fallback */}
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="scan" stroke="var(--text-muted)" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="cnn" name="CNN Risk" stroke="#A78BFA" fillOpacity={1} fill="url(#colorCnn)" />
                  <Area type="monotone" dataKey="cv" name="CV Risk" stroke="#60A5FA" fillOpacity={1} fill="url(#colorCv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card fade-in-up stagger-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{
                fontFamily: HEADING_FONT,
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 16px 0"
              }}>Global Classification Distribution</h3>
              <div style={{ position: 'relative', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={analyticsData.pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} dataKey="value" strokeWidth={0}
                      animationBegin={300} animationDuration={1000}
                    >
                      {analyticsData.pieData.map((_, i) => (
                        <Cell key={i} fill={analyticsData.PIE_COLORS[i % analyticsData.PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text for donut chart */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: HEADING_FONT }}>
                    {analyticsData.total}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Scans
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.success }}></div>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Passed ({analyticsData.passed})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.danger }}></div>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Defective ({analyticsData.defects})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full History Table */}
          <div className="card fade-in-up" style={{ animationDelay: "0.4s" }}>
            <div className="card-header" style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{
                fontFamily: HEADING_FONT,
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0
              }}>Raw Prediction Log</h3>
              <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                Showing last {Math.min(100, analyticsData.total)} records
              </span>
            </div>
            <div className="history-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Visual</th>
                    <th>Identifier</th>
                    <th>Prediction</th>
                    <th>Confidence</th>
                    <th>Defect Risk</th>
                    <th>Pipeline Split (CNN / CV)</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analyticsData.normalized].reverse().slice(0, 100).map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: MONO_FONT, fontSize: "12px", color: "var(--text-muted)" }}>{analyticsData.total - i}</td>
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
                      <td style={{ fontFamily: MONO_FONT, fontSize: "13px" }}>{item.confidence}%</td>
                      <td style={{ fontFamily: MONO_FONT, fontSize: "13px", color: item.defect_probability > 50 ? "var(--danger)" : "var(--success)" }}>
                        {item.defect_probability}%
                      </td>
                      <td style={{ fontSize: "12px", fontFamily: MONO_FONT, color: "var(--text-muted)" }}>
                        <span style={{ color: COLORS.purple }}>{item.cnn_defect_probability || '-'}%</span> / <span style={{ color: COLORS.blue }}>{item.cv_defect_probability || '-'}%</span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.time?.replace(',', '')}</td>
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
