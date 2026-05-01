import React, { useState, useRef } from "react";
import { FiXCircle, FiCheckCircle, FiRefreshCw, FiUpload, FiCamera, FiShield, FiSave, FiZap, FiImage, FiUploadCloud } from "react-icons/fi";
import ImageUpload from "../components/ImageUpload";
import CameraCapture from "../components/CameraCapture";
import ConfidenceGauge from "../components/ConfidenceGauge";
import { auth } from '../firebaseClient';

function DetectPage({ onResult }) {
  const [sourceMode, setSourceMode] = useState("upload");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filename, setFilename] = useState("");
  const [saved, setSaved] = useState(false);

  const previewRef = useRef(null);
  const filenameRef = useRef("");

  const canSave = Boolean(auth.currentUser);

  const handlePreview = (val) => {
    previewRef.current = val;
    setPreview(val);
  };

  const handleFilename = (val) => {
    filenameRef.current = val;
    setFilename(val);
  };

  const handleResult = (prediction) => {
    setResult(prediction);
  };

  const handleSave = async () => {
    if (!result) return;
    const entry = {
      request_id: result.request_id,
      label: result.label,
      confidence: result.confidence,
      defect_probability: result.defect_probability,
      source: sourceMode,
      pipeline: result.pipeline || "ssim_cv_hybrid",
      ssim_defect_probability: result.ssim_defect_probability,
      feature_defect_probability: result.feature_defect_probability,
      preview,
      filename,
      time: new Date().toLocaleTimeString(),
    };
    await onResult(entry);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  const handleReset = () => {
    setResult(null);
    setPreview(null);
    setRefPreview(null);
    setLoading(false);
    setError(null);
    setFilename("");
    setSaved(false);
  };

  const isDefective = result?.label === "defective";

  const switchSourceMode = (mode) => {
    if (mode === sourceMode) return;
    setSourceMode(mode);
    handleReset();
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: "24px" }}>
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
          <FiShield style={{ color: "var(--accent)" }} /> Defect Detection
        </h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "15px" }}>
          Upload fabric images or capture live to instantly analyze for defects
        </p>
        <div style={{
          marginTop: "12px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "10px 14px",
          display: "inline-flex",
          alignItems: "center",
          gap: "12px",
          maxWidth: "450px",
          width: "100%"
        }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>Backend API:</span>
          <input
            type="text"
            placeholder="e.g. https://textile-backend.onrender.com"
            defaultValue={localStorage.getItem("VITE_API_URL") || import.meta.env.VITE_API_URL || "https://textile-backend.onrender.com"}
            onChange={(e) => {
              localStorage.setItem("VITE_API_URL", e.target.value);
            }}
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              padding: "4px 8px",
              color: "var(--text-primary)",
              fontSize: "12px",
              flex: 1,
              outline: "none",
              fontFamily: '"JetBrains Mono", monospace'
            }}
          />
        </div>
      </div>

      <div className="content-grid">
        {/* Left: Input Source */}
        <div className="card fade-in-up">
          <div className="card-header" style={{ marginBottom: "16px" }}>
            <h3 style={{
              fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0
            }}>Image Source</h3>
            {(preview || refPreview || result) && (
              <button className="btn btn-outline btn-sm" onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <FiRefreshCw size={13} /> New Scan
              </button>
            )}
          </div>

          {/* Source Mode Toggle */}
          <div className="detect-source-switch" style={{
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-sm)",
            padding: "4px",
            display: "inline-flex",
            gap: "4px",
            marginBottom: "18px"
          }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: sourceMode === "upload" ? "var(--accent)" : "transparent",
                color: sourceMode === "upload" ? "#0A0A0F" : "var(--text-secondary)",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: sourceMode === "upload" ? 700 : 500,
                transition: "all 0.2s ease"
              }}
              onClick={() => switchSourceMode("upload")}
            >
              <FiUpload size={13} /> Upload
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: sourceMode === "camera" ? "var(--accent)" : "transparent",
                color: sourceMode === "camera" ? "#0A0A0F" : "var(--text-secondary)",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: sourceMode === "camera" ? 700 : 500,
                transition: "all 0.2s ease"
              }}
              onClick={() => switchSourceMode("camera")}
            >
              <FiCamera size={13} /> Camera
            </button>
          </div>

          {sourceMode === "upload" ? (
            <ImageUpload
              setResult={handleResult}
              setPreview={handlePreview}
              setRefPreview={setRefPreview}
              setLoading={setLoading}
              setError={setError}
              setFilename={handleFilename}
              loading={loading}
              userId={auth.currentUser?.uid}
              source="upload"
            />
          ) : (
            <CameraCapture
              setResult={handleResult}
              setPreview={handlePreview}
              setLoading={setLoading}
              setError={setError}
              setFilename={handleFilename}
              loading={loading}
              userId={auth.currentUser?.uid}
              source="camera"
            />
          )}

          {/* Image Preview with scanning overlay */}
          {(preview || refPreview) && (
            <div className="preview-section" style={{ position: "relative", marginTop: "24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
              {refPreview && (
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", 
                    fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--success)", textTransform: "uppercase" 
                  }}>
                    <FiImage size={12} /> Reference Pattern
                  </div>
                  <img src={refPreview} alt="Reference Preview" style={{
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-light)",
                    width: "100%",
                    display: "block"
                  }} />
                </div>
              )}
              {preview && (
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", 
                    fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--accent)", textTransform: "uppercase" 
                  }}>
                    <FiUploadCloud size={12} /> Test Fabric
                  </div>
                  <div style={{ position: "relative" }}>
                    <img src={result?.diff_image ? `data:image/jpeg;base64,${result.diff_image}` : preview} alt="Test Preview" style={{
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--accent)",
                      boxShadow: "0 0 12px rgba(59, 130, 246, 0.15)",
                      width: "100%",
                      display: "block"
                    }} />
                    {loading && (
                      <div className="scanning-overlay">
                        <div className="scanning-line" />
                      </div>
                    )}
                    {result?.diff_image && (
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        background: "var(--danger)", color: "#fff",
                        padding: "4px 8px", borderRadius: "4px",
                        fontSize: "10px", fontWeight: "bold",
                        letterSpacing: "0.05em", textTransform: "uppercase"
                      }}>
                        Heatmap Diff
                      </div>
                    )}
                  </div>
                  {filename && !result?.diff_image && <p className="preview-filename" style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", wordBreak: "break-all" }}>{filename}</p>}
                  {result?.diff_image && <p className="preview-filename" style={{ marginTop: "8px", fontSize: "12px", color: "var(--accent)", wordBreak: "break-all", fontWeight: 600 }}>Visual Difference Highlighted</p>}
                </div>
              )}
              {loading && (
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  background: "rgba(15, 19, 28, 0.9)",
                  padding: "12px 24px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "var(--primary)",
                  fontSize: "14px",
                  fontWeight: 600,
                  zIndex: 11,
                  backdropFilter: "blur(8px)",
                  border: "1px solid var(--accent)",
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.6)"
                }}>
                  <FiZap className="spin-icon" style={{ color: "var(--accent)" }} /> Comparing Structures...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {loading && !preview && (
            <div className="card centered-card fade-in-up">
              <div className="spinner" />
              <p className="loading-text">Analyzing fabric patterns...</p>
            </div>
          )}

          {error && (
            <div className="error-card fade-in-up" style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              animation: "fadeInUp 0.3s ease forwards"
            }}>
              <FiXCircle /> {error}
            </div>
          )}

          {result && !loading && (
            <div className={`result-card fade-in-up ${isDefective ? "defective-result" : ""}`}>
              <div className="result-status">
                <span className={`result-badge ${isDefective ? "defective" : "ok"}`}>
                  {isDefective ? <FiXCircle /> : <FiCheckCircle />}
                  {isDefective ? "Defective" : "Passed"}
                </span>
              </div>

              <ConfidenceGauge
                value={result.confidence}
                color={isDefective ? "var(--danger)" : "var(--success)"}
              />

              <div className="result-metrics" style={{ marginTop: "20px" }}>
                <h4 style={{ 
                  fontSize: "13px", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em", 
                  color: "var(--text-muted)", 
                  marginBottom: "12px",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "8px",
                  margin: "0 0 12px 0"
                }}>
                  Overall Assessment
                </h4>

                <div className="result-metric">
                  <div className="result-metric-header">
                    <span className="result-metric-label">Composite Defect Risk</span>
                    <span className="result-metric-value" style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      color: result.defect_probability > 50 ? "var(--danger)" : "var(--success)"
                    }}>{result.defect_probability}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${result.defect_probability > 50 ? "red" : "green"}`}
                      style={{ width: `${result.defect_probability}%` }}
                    />
                  </div>
                </div>

                <h4 style={{ 
                  fontSize: "13px", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.05em", 
                  color: "var(--text-muted)", 
                  marginTop: "24px",
                  marginBottom: "12px",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "8px"
                }}>
                  Technical Breakdown
                </h4>

                <div className="result-metric">
                  <div className="result-metric-header">
                    <span className="result-metric-label">SSIM Match Discrepancy</span>
                    <span className="result-metric-value" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {result.ssim_defect_probability}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${result.ssim_defect_probability}%`, background: "var(--text-secondary)" }} />
                  </div>
                </div>

                <div className="result-metric" style={{ marginTop: "16px" }}>
                  <div className="result-metric-header">
                    <span className="result-metric-label">Pattern Feature Variance</span>
                    <span className="result-metric-value" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {result.feature_defect_probability}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${result.feature_defect_probability}%`, background: "var(--text-secondary)" }} />
                  </div>
                </div>

                <div style={{
                  marginTop: "16px",
                  padding: "12px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  color: "var(--text-secondary)",
                  borderLeft: `3px solid ${isDefective ? "var(--danger)" : "var(--success)"}`
                }}>
                  <strong style={{ color: "var(--text-primary)" }}>System Analysis Note: </strong>
                  {result.defect_probability > 50 
                    ? (result.ssim_defect_probability > 70 && result.feature_defect_probability > 70 
                        ? "Both SSIM comparison and structural features confirm severe fabric defects." 
                        : "Anomalies detected in fabric pattern structure indicating localized damage.")
                    : (result.feature_defect_probability > 50 
                        ? "High structural variance detected, but overall match confirmed it as an acceptable pattern variation."
                        : "Fabric structural integrity is normal. No significant anomalies detected.")}
                </div>
              </div>

              {/* Action buttons inside result card */}
              <div style={{
                marginTop: "24px",
                paddingTop: "18px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}>
                <button className="btn btn-outline btn-sm" onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <FiRefreshCw size={13} /> Scan Again
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!canSave} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <FiSave size={13} /> Save Result
                </button>
                {!canSave && <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Sign in to save</small>}
              </div>
            </div>
          )}

          {!result && !loading && !error && (
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
                background: "var(--accent-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "var(--accent)",
                fontSize: "24px"
              }}>
                <FiShield />
              </div>
              <h3 style={{
                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: "0 0 8px 0"
              }}>Waiting for Image</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.5" }}>
                Upload a fabric image or capture one to see real-time defect analysis
              </p>
            </div>
          )}
        </div>
      </div>

      {saved && (
        <div style={{
          position: "fixed",
          bottom: "32px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--success)",
          color: "#000",
          padding: "12px 24px",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0, 255, 128, 0.25)",
          zIndex: 999,
          animation: "fadeInUp 0.3s ease forwards"
        }}>
          <FiCheckCircle size={18} />
          Result Successfully Saved!
        </div>
      )}
    </div>
  );
}

export default DetectPage;
