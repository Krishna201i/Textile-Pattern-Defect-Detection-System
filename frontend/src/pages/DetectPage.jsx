import React, { useState, useRef } from "react";
import { FiXCircle, FiCheckCircle, FiRefreshCw } from "react-icons/fi";
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
    // Prepare entry shape expected by savePrediction
    const entry = {
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
  };

  const handleReset = () => {
    setResult(null);
    setPreview(null);
    setLoading(false);
    setError(null);
    setFilename("");
  };

  const isDefective = result?.label === "defective";

  const switchSourceMode = (mode) => {
    if (mode === sourceMode) return;
    setSourceMode(mode);
    handleReset();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Detect Defects</h2>
        <p>Use image upload by default, or capture from camera with quality checks</p>
      </div>

      <div className="content-grid">
        {/* Left: Input Source */}
        <div className="card">
          <div className="card-header">
            <h3>Image Source</h3>
            {(preview || result) && (
              <button className="btn btn-outline btn-sm" onClick={handleReset}>
                <FiRefreshCw /> New Scan
              </button>
            )}
          </div>

          <div className="detect-source-switch">
            <button
              type="button"
              className={`btn btn-sm ${sourceMode === "upload" ? "btn-primary" : "btn-outline"}`}
              onClick={() => switchSourceMode("upload")}
            >
              Upload Image
            </button>
            <button
              type="button"
              className={`btn btn-sm ${sourceMode === "camera" ? "btn-primary" : "btn-outline"}`}
              onClick={() => switchSourceMode("camera")}
            >
              Camera Capture
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
            />
          ) : (
            <CameraCapture
              setResult={handleResult}
              setPreview={handlePreview}
              setLoading={setLoading}
              setError={setError}
              setFilename={handleFilename}
              loading={loading}
            />
          )}

          {preview && (
            <div className="preview-section">
              <img src={preview} alt="Preview" />
              {filename && <p className="preview-filename">{filename}</p>}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div>
          {loading && (
            <div className="card centered-card">
              <div className="spinner" />
              <p className="loading-text">Analyzing fabric...</p>
            </div>
          )}

          {error && (
            <div className="error-card">
              <FiXCircle /> {error}
            </div>
          )}

          {result && !loading && (
            <div className="result-card">
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

              <div className="result-metrics">
                <div className="result-metric">
                  <div className="result-metric-header">
                    <span className="result-metric-label">Defect Probability</span>
                    <span className="result-metric-value">{result.defect_probability}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${result.defect_probability > 50 ? "red" : "green"}`}
                      style={{ width: `${result.defect_probability}%` }}
                    />
                  </div>
                </div>

                <div className="result-metric">
                  <div className="result-metric-header">
                    <span className="result-metric-label">Confidence</span>
                    <span className="result-metric-value">{result.confidence}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill blue"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!result && !loading && !error && (
            <div className="card">
              <div className="empty-state">
                <FiCheckCircle />
                <h3>Waiting for image</h3>
                <p>Upload a fabric image to see detection results</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="detect-actions">
        <button className="btn" onClick={handleReset}>Reset</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
          Save
        </button>
        {!canSave && <small className="detect-save-note">Sign in to save scans</small>}
      </div>
    </div>
  );
}

export default DetectPage;
