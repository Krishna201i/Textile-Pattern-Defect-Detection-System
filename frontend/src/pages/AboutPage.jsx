import React, { useEffect, useState } from "react";
import { FiCpu, FiLayers, FiTarget, FiMaximize, FiActivity, FiAward, FiUpload, FiSettings, FiZap, FiBarChart2 } from "react-icons/fi";
import axios from "axios";

function AboutPage() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    axios.get("/api/model-info")
      .then((res) => setInfo(res.data))
      .catch(() => {});
  }, []);

  const steps = [
    { icon: <FiUpload />, title: "Upload Image", desc: "Select or drag-and-drop a fabric image. Supported: PNG, JPG, JPEG, BMP, TIFF.", color: "var(--accent)" },
    { icon: <FiSettings />, title: "Preprocessing", desc: "Image is resized to 224×224 and normalized to [0, 1] for model input.", color: "var(--purple)" },
    { icon: <FiCpu />, title: "CNN Analysis", desc: "MobileNetV2 with transfer learning extracts features and classifies the pattern.", color: "var(--cyan)" },
    { icon: <FiTarget />, title: "Classification", desc: "The model outputs a defective/non-defective label with a confidence score.", color: "var(--success)" },
    { icon: <FiBarChart2 />, title: "Results & Analytics", desc: "View results, session statistics, trends, and export reports as CSV.", color: "var(--warning)" }
  ];

  const techStack = [
    { name: "React 18", color: "blue" },
    { name: "Vite", color: "blue" },
    { name: "Flask", color: "green" },
    { name: "Python", color: "green" },
    { name: "TensorFlow", color: "warning" },
    { name: "Keras", color: "warning" },
    { name: "MobileNetV2", color: "purple" },
    { name: "Transfer Learning", color: "purple" },
    { name: "Recharts", color: "blue" },
    { name: "OpenCV", color: "green" }
  ];

  return (
    <div className="fade-in">
      {/* Hero */}
      <div style={{
        textAlign: "center",
        marginBottom: "32px",
        padding: "40px 20px",
        background: "linear-gradient(135deg, rgba(245,166,35,0.06), rgba(167,139,250,0.03))",
        borderRadius: "var(--radius)",
        border: "1px solid rgba(245,166,35,0.08)",
        backdropFilter: "blur(12px)",
        animation: "fadeInUp 0.5s ease forwards"
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
          fontSize: "28px",
          color: "var(--accent)",
          boxShadow: "0 0 30px var(--accent-glow)"
        }}>
          <FiCpu />
        </div>
        <h2 style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: "clamp(1.6rem, 1.2rem + 1vw, 2.4rem)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text-primary)",
          margin: "0 0 8px 0"
        }}>About the Model</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px", maxWidth: "500px", margin: "0 auto" }}>
          Deep learning powered fabric defect detection system
        </p>
      </div>

      {/* Model Architecture Card */}
      <div className="card fade-in-up" style={{ marginBottom: "24px" }}>
        <h3 style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 20px 0",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <FiLayers style={{ color: "var(--purple)" }} /> Model Architecture
        </h3>
        <div className="info-grid">
          {[
            { label: "Architecture", value: info?.model_name || "MobileNetV2" },
            { label: "Task", value: info?.task || "Binary Classification" },
            { label: "Input Size", value: info?.input_size || "224×224×3" },
            { label: "Classes", value: info?.classes?.join(", ") || "defective, non_defective" },
            ...(info?.training_epochs ? [{ label: "Training Epochs", value: info.training_epochs }] : []),
            ...(info?.final_val_accuracy ? [{ label: "Val Accuracy", value: `${(info.final_val_accuracy * 100).toFixed(1)}%` }] : [])
          ].map((item, i) => (
            <div key={i} className="info-item" style={{
              animation: `fadeInUp 0.3s ease ${0.1 + i * 0.05}s forwards`,
              opacity: 0
            }}>
              <div className="info-label">{item.label}</div>
              <div className="info-value">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works - Animated Steps */}
      <div className="card fade-in-up stagger-2" style={{ marginBottom: "24px" }}>
        <h3 style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 24px 0",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <FiActivity style={{ color: "var(--accent)" }} /> How It Works
        </h3>
        <div style={{ position: "relative" }}>
          {/* Connecting line */}
          <div style={{
            position: "absolute",
            left: "22px",
            top: "28px",
            bottom: "28px",
            width: "2px",
            background: "linear-gradient(to bottom, var(--accent), var(--purple), var(--cyan), var(--success), var(--warning))",
            opacity: 0.3,
            borderRadius: "2px"
          }} />

          {steps.map((step, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "18px",
              padding: "16px",
              marginBottom: i < steps.length - 1 ? "8px" : 0,
              borderRadius: "var(--radius-sm)",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid transparent",
              transition: "all 0.25s ease",
              position: "relative",
              animation: `fadeInUp 0.4s ease ${0.15 + i * 0.08}s forwards`,
              opacity: 0,
              cursor: "default"
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "var(--border-color)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: `${step.color}15`,
                color: step.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                flexShrink: 0,
                border: `1px solid ${step.color}20`,
                position: "relative",
                zIndex: 1
              }}>
                {step.icon}
              </div>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{step.title}</h4>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.45" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card fade-in-up stagger-4">
        <h3 style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 16px 0",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <FiAward style={{ color: "var(--success)" }} /> Technology Stack
        </h3>
        <div className="tech-stack">
          {techStack.map((tech, i) => (
            <span key={i} className={`tech-tag ${tech.color}`} style={{
              animation: `scaleIn 0.3s ease ${0.1 + i * 0.04}s forwards`,
              opacity: 0,
              cursor: "default",
              transition: "all 0.2s ease"
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {tech.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
