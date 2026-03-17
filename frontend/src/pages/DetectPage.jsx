import React, { useState, useRef } from "react";
import { FiXCircle, FiCheckCircle, FiRefreshCw, FiUpload, FiCamera, FiShield, FiSave, FiZap } from "react-icons/fi";
import ImageUpload from "../components/ImageUpload";
import CameraCapture from "../components/CameraCapture";
import ConfidenceGauge from "../components/ConfidenceGauge";
import { auth } from '../firebaseClient';

function DetectPage({ onResult }) {
  const [sourceMode, setSourceMode] = useState("upload");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
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
      pipeline: result.pipeline || "cnn_cv_hybrid",
      cnn_defect_probability: result.cnn_defect_probability,
      cv_defect_probability: result.cv_defect_probability,
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
            {(preview || result) && (
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
          {preview && (
            <div className="preview-section" style={{ position: "relative", marginTop: "16px" }}>
              <img src={preview} alt="Preview" style={{
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                width: "100%",
                display: "block"
              }} />
              {loading && (
                <div className="scanning-overlay">
                  <div className="scanning-line" />
                  <div style={{
                    background: "rgba(8,8,13,0.8)",
                    padding: "10px 20px",
                    borderRadius: "999px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--accent)",
                    fontSize: "13px",
                    fontWeight: 600,
                    zIndex: 11,
                    backdropFilter: "blur(8px)"
                  }}>
                    <FiZap /> Analyzing...
                  </div>
                </div>
              )}
              {filename && <p className="preview-filename" style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>{filename}</p>}
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

                <div className="result-metric" style={{ marginTop: "16px" }}>
                  <div className="result-metric-header">
                    <span className="result-metric-label">Model Confidence</span>
                    <span className="result-metric-value" style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      color: "var(--accent)"
                    }}>{result.confidence}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill blue"
                      style={{ width: `${result.confidence}%` }}
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
                  Technical AI Breakdown
                </h4>

                <div className="result-metric">
                  <div className="result-metric-header">
                    <span className="result-metric-label">Neural Network (CNN)</span>
                    <span className="result-metric-value" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {result.cnn_defect_probability}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${result.cnn_defect_probability}%`, background: "var(--text-secondary)" }} />
                  </div>
                </div>

                <div className="result-metric" style={{ marginTop: "16px" }}>
                  <div className="result-metric-header">
                    <span className="result-metric-label">Structural Vision (CV)</span>
                    <span className="result-metric-value" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {result.cv_defect_probability}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${result.cv_defect_probability}%`, background: "var(--text-secondary)" }} />
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
                  <strong style={{ color: "var(--text-primary)" }}>AI Inspector Note: </strong>
                  {result.defect_probability > 50 
                    ? (result.cnn_defect_probability > 70 && result.cv_defect_probability > 70 
                        ? "Both neural and structural analysis confirm severe fabric defects." 
                        : "Anomalies detected in fabric pattern structure indicating localized damage.")
                    : (result.cv_defect_probability > 50 
                        ? "High structural variance detected, but neural network confirmed it as normal fabric pattern/texture."
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
