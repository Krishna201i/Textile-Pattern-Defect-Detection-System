import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FiUploadCloud, FiImage, FiZap } from "react-icons/fi";
import axios from "axios";

function ImageUpload({ setResult, setPreview, setRefPreview, setLoading, setError, setFilename, loading, userId, source = "upload" }) {
  const [refFile, setRefFile] = useState(null);
  const [testFile, setTestFile] = useState(null);

  const onDropRef = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setRefFile(file);
    const reader = new FileReader();
    reader.onload = () => { if (setRefPreview) setRefPreview(reader.result); };
    reader.readAsDataURL(file);
  }, [setRefPreview]);

  const onDropTest = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setTestFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
    if (setFilename) setFilename(file.name);
  }, [setPreview, setFilename]);

  const handleAnalyze = async () => {
    if (!testFile) {
      setError("Please upload a test fabric image to inspect.");
      return;
    }
    
    setResult(null);
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("image", testFile);
    if (refFile) {
      formData.append("reference", refFile);
    }
    if (userId) formData.append("owner", userId);
    formData.append("source", source);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await axios.post(`${apiUrl}/api/predict`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setResult({
          ...response.data.prediction,
          request_id: response.data.request_id,
          trace_id: response.data.trace_id,
          source,
        });
      } else {
        const errorMsg = response.data.error || "Prediction failed";
        setError(typeof errorMsg === "object" ? errorMsg.message || errorMsg.error || JSON.stringify(errorMsg) : String(errorMsg));
      }
    } catch (err) {
      const errObj = err.response?.data || {};
      const errorMsg = errObj.error || errObj.message || err.message || "Failed to connect to the server. Make sure the backend is running.";
      setError(typeof errorMsg === "object" ? errorMsg.message || errorMsg.error || JSON.stringify(errorMsg) : String(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps: getRefProps, getInputProps: getRefInProps, isDragActive: isRefDrag } = useDropzone({
    onDrop: onDropRef, accept: { "image/*": [".png", ".jpg", ".jpeg", ".bmp", ".tiff"] }, maxFiles: 1, disabled: loading,
  });

  const { getRootProps: getTestProps, getInputProps: getTestInProps, isDragActive: isTestDrag } = useDropzone({
    onDrop: onDropTest, accept: { "image/*": [".png", ".jpg", ".jpeg", ".bmp", ".tiff"] }, maxFiles: 1, disabled: loading,
  });

  return (
    <div className="upload-container">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        
        {/* Reference Image Dropzone */}
        <div {...getRefProps()} className={`dropzone ${isRefDrag ? "dropzone-active" : ""} ${loading ? "dropzone-disabled" : ""}`} style={{ padding: "32px 16px", minHeight: "180px", display: "flex", flexDirection: "column", justifyContent: "center", borderStyle: "dashed" }}>
          <input {...getRefInProps()} />
          <FiImage className="dropzone-icon" style={{ color: refFile ? "var(--success)" : "" }} />
          <h4 style={{ margin: "8px 0 4px", fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>1. Golden Sample</h4>
          <p className="dropzone-text" style={{ fontSize: "12px", margin: 0, color: "var(--text-muted)" }}>
            {refFile ? <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{refFile.name}</span> : "Upload perfect reference pattern"}
          </p>
        </div>

        {/* Test Image Dropzone */}
        <div {...getTestProps()} className={`dropzone ${isTestDrag ? "dropzone-active" : ""} ${loading ? "dropzone-disabled" : ""}`} style={{ padding: "32px 16px", minHeight: "180px", display: "flex", flexDirection: "column", justifyContent: "center", borderStyle: testFile ? "solid" : "dashed", borderColor: testFile ? "var(--accent)" : "" }}>
          <input {...getTestInProps()} />
          <FiUploadCloud className="dropzone-icon" style={{ color: testFile ? "var(--accent)" : "" }} />
          <h4 style={{ margin: "8px 0 4px", fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>2. Test Fabric</h4>
          <p className="dropzone-text" style={{ fontSize: "12px", margin: 0, color: "var(--text-muted)" }}>
            {testFile ? <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{testFile.name}</span> : "Upload fabric to inspect"}
          </p>
        </div>

      </div>

      <button 
        className="btn btn-primary" 
        style={{ width: "100%", padding: "14px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 600 }}
        onClick={handleAnalyze}
        disabled={loading || !testFile}
      >
        <FiZap /> {loading ? "Running Comparison..." : "Analyze Fabric Comparison"}
      </button>
    </div>
  );
}

export default ImageUpload;
