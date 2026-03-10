import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FiUploadCloud } from "react-icons/fi";
import axios from "axios";

function ImageUpload({ setResult, setPreview, setLoading, setError, setFilename, loading, userId, source = "upload" }) {
  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Show preview and capture filename
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(file);
      if (setFilename) setFilename(file.name);

      // Clear previous results
      setResult(null);
      setError(null);
      setLoading(true);

      // Send to backend
      const formData = new FormData();
      formData.append("image", file);
      if (userId) formData.append("owner", userId);
      formData.append("source", source);

      try {
        const response = await axios.post("/api/predict", formData, {
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
          setError(response.data.error || "Prediction failed");
        }
      } catch (err) {
        const message =
          err.response?.data?.error ||
          "Failed to connect to the server. Make sure the backend is running.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [setResult, setPreview, setLoading, setError, userId, source]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".bmp", ".tiff"],
    },
    maxFiles: 1,
    disabled: loading,
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "dropzone-active" : ""} ${loading ? "dropzone-disabled" : ""}`}
    >
      <input {...getInputProps()} />
      <FiUploadCloud className="dropzone-icon" />
      {isDragActive ? (
        <p>Drop the image here...</p>
      ) : (
        <>
          <p className="dropzone-text">
            Drag & drop a fabric image here, or click to browse
          </p>
          <p className="dropzone-hint">PNG, JPG, JPEG, BMP, TIFF (max 16MB)</p>
        </>
      )}
    </div>
  );
}

export default ImageUpload;
