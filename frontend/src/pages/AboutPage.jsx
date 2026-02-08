import React, { useEffect, useState } from "react";
import { FiCpu, FiLayers, FiTarget, FiMaximize, FiActivity, FiAward } from "react-icons/fi";
import axios from "axios";

function AboutPage() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    axios.get("/api/model-info")
      .then((res) => setInfo(res.data))
      .catch(() => {});
  }, []);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>About the Model</h2>
        <p>Technical details about the detection system</p>
      </div>

      {/* Model Info Grid */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>Model Architecture</h3>
        </div>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Architecture</div>
            <div className="info-value">{info?.model_name || "MobileNetV2"}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Task</div>
            <div className="info-value">{info?.task || "Binary Classification"}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Input Size</div>
            <div className="info-value">{info?.input_size || "224x224x3"}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Classes</div>
            <div className="info-value">{info?.classes?.join(", ") || "defective, non_defective"}</div>
          </div>
          {info?.training_epochs && (
            <div className="info-item">
              <div className="info-label">Training Epochs</div>
              <div className="info-value">{info.training_epochs}</div>
            </div>
          )}
          {info?.final_val_accuracy && (
            <div className="info-item">
              <div className="info-label">Validation Accuracy</div>
              <div className="info-value">{(info.final_val_accuracy * 100).toFixed(1)}%</div>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-header">
          <h3>How It Works</h3>
        </div>
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Upload Image</h4>
              <p>Select or drag-and-drop a fabric image. Supported formats: PNG, JPG, JPEG, BMP, TIFF.</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Preprocessing</h4>
              <p>Image is resized to 224x224 pixels and normalized to [0, 1] range for model input.</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>CNN Analysis</h4>
              <p>MobileNetV2 with transfer learning extracts features and classifies the fabric pattern.</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Classification</h4>
              <p>The model outputs a defective/non-defective label with a confidence score.</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">5</div>
            <div className="step-content">
              <h4>Results & Analytics</h4>
              <p>View results, session statistics, trends, and export reports as CSV.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card">
        <div className="card-header">
          <h3>Technology Stack</h3>
        </div>
        <div className="tech-stack">
          <span className="tech-tag">React 18</span>
          <span className="tech-tag">Vite</span>
          <span className="tech-tag green">Flask</span>
          <span className="tech-tag green">Python</span>
          <span className="tech-tag warning">TensorFlow</span>
          <span className="tech-tag warning">Keras</span>
          <span className="tech-tag purple">MobileNetV2</span>
          <span className="tech-tag purple">Transfer Learning</span>
          <span className="tech-tag">Recharts</span>
          <span className="tech-tag green">OpenCV</span>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
