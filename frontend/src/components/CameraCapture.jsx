import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { FiCamera, FiVideo, FiRefreshCw } from "react-icons/fi";

function evaluateFrameQuality(imageData) {
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
    isBrightnessGood: meanBrightness >= 55 && meanBrightness <= 210,
    isSharpEnough: varianceLap >= 60,
  };
}

function CameraCapture({
  setResult,
  setPreview,
  setLoading,
  setError,
  setFilename,
  loading,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);

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
    const quality = evaluateFrameQuality(imageData);

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

      const response = await axios.post("/api/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setResult(response.data.prediction);
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

      <p className="camera-hint">
        <FiVideo /> Camera mode runs a quality check before prediction.
      </p>
    </div>
  );
}

export default CameraCapture;