import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { FiCamera, FiVideo, FiRefreshCw } from "react-icons/fi";

const QUALITY_THRESHOLDS = {
  minBrightness: 40,
  maxBrightness: 225,
  minBlurVariance: 35,
};

function evaluateFrameQuality(imageData, thresholds = QUALITY_THRESHOLDS) {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);

  let brightnessSum = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[y * width + x] = lum;
      brightnessSum += lum;
    }
  }

  const meanBrightness = brightnessSum / (width * height);

  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap =
        4 * gray[i] -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - width] -
        gray[i + width];

      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      count += 1;
    }
  }

  const meanLap = count ? laplacianSum / count : 0;
  const varianceLap = count ? laplacianSqSum / count - meanLap * meanLap : 0;

  return {
    brightness: Number(meanBrightness.toFixed(1)),
    blurVariance: Number(varianceLap.toFixed(1)),
    isBrightnessGood:
      meanBrightness >= thresholds.minBrightness &&
      meanBrightness <= thresholds.maxBrightness,
    isSharpEnough: varianceLap >= thresholds.minBlurVariance,
  };
}

function CameraCapture({
  setResult,
  setPreview,
  setLoading,
  setError,
  setFilename,
  loading,
  userId,
  source = "camera",
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [liveQuality, setLiveQuality] = useState(null);
  const [thresholds, setThresholds] = useState(QUALITY_THRESHOLDS);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (_err) {
      setError("Unable to access camera. Please allow camera permission or use image upload.");
      setCameraReady(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    let timerId;

    if (cameraReady && videoRef.current && canvasRef.current) {
      timerId = setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.videoWidth < 2 || video.videoHeight < 2) {
          return;
        }

        const ctx = canvas.getContext("2d");
        const sampleWidth = 320;
        const sampleHeight = 240;
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;
        ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);

        const sampleData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
        setLiveQuality(evaluateFrameQuality(sampleData, thresholds));
      }, 700);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [cameraReady, thresholds]);

  const captureAndPredict = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) {
      setError("Camera is not ready yet. Please wait a moment.");
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const quality = evaluateFrameQuality(imageData, thresholds);

    if (!quality.isBrightnessGood || !quality.isSharpEnough) {
      const reasons = [];
      if (!quality.isBrightnessGood) reasons.push("lighting is poor");
      if (!quality.isSharpEnough) reasons.push("image is blurry");
      setError(
        `Capture quality check failed: ${reasons.join(" and ")}. Brightness ${quality.brightness}, blur score ${quality.blurVariance}. Retake with steady hands and better light.`
      );
      return;
    }

    const previewDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreview(previewDataUrl);
    const generatedName = `camera_capture_${Date.now()}.jpg`;
    if (setFilename) setFilename(generatedName);

    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const blob = await new Promise((resolve) =>
        canvas.toBlob((fileBlob) => resolve(fileBlob), "image/jpeg", 0.92)
      );

      if (!blob) {
        throw new Error("Unable to prepare captured image");
      }

      const imageFile = new File([blob], generatedName, { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("image", imageFile);
      if (userId) formData.append("owner", userId);
      formData.append("source", source);

      const apiUrl = localStorage.getItem("VITE_API_URL") || import.meta.env.VITE_API_URL || "https://textile-backend.onrender.com";
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

  return (
    <div className="camera-capture">
      <div className="camera-preview-wrap">
        <video ref={videoRef} muted playsInline className="camera-preview" />
      </div>

      <canvas ref={canvasRef} className="camera-canvas-hidden" />

      <div className="camera-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={captureAndPredict}
          disabled={loading || !cameraReady}
        >
          <FiCamera /> Capture & Analyze
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={startCamera}
          disabled={loading}
        >
          <FiRefreshCw /> Refresh Camera
        </button>
      </div>

      {liveQuality && (
        <div className="camera-quality-meter">
          <div className="camera-quality-row">
            <span>Brightness</span>
            <span>{liveQuality.brightness}</span>
          </div>
          <div className="camera-quality-row">
            <span>Blur Score</span>
            <span>{liveQuality.blurVariance}</span>
          </div>
          <div className="camera-quality-tags">
            <span className={`camera-quality-tag ${liveQuality.isBrightnessGood ? "ok" : "bad"}`}>
              {liveQuality.isBrightnessGood ? "Lighting OK" : "Lighting Adjust"}
            </span>
            <span className={`camera-quality-tag ${liveQuality.isSharpEnough ? "ok" : "bad"}`}>
              {liveQuality.isSharpEnough ? "Sharpness OK" : "Hold Steady"}
            </span>
          </div>

          <div className="camera-thresholds-grid">
            <label>
              Min Brightness
              <input
                type="number"
                min="0"
                max="255"
                value={thresholds.minBrightness}
                onChange={(e) => {
                  const value = Number(e.target.value || 0);
                  setThresholds((prev) => ({ ...prev, minBrightness: value }));
                }}
              />
            </label>
            <label>
              Max Brightness
              <input
                type="number"
                min="0"
                max="255"
                value={thresholds.maxBrightness}
                onChange={(e) => {
                  const value = Number(e.target.value || 0);
                  setThresholds((prev) => ({ ...prev, maxBrightness: value }));
                }}
              />
            </label>
            <label>
              Min Blur Score
              <input
                type="number"
                min="0"
                max="1000"
                value={thresholds.minBlurVariance}
                onChange={(e) => {
                  const value = Number(e.target.value || 0);
                  setThresholds((prev) => ({ ...prev, minBlurVariance: value }));
                }}
              />
            </label>
          </div>
        </div>
      )}

      <p className="camera-hint">
        <FiVideo /> Camera mode runs a quality check before prediction.
      </p>
    </div>
  );
}

export default CameraCapture;