import React, { useState, useEffect } from 'react';
import { FiCpu, FiHardDrive, FiActivity, FiClock, FiAlertCircle, FiSettings } from 'react-icons/fi';

export default function PerformancePage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchMetrics = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/performance`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json();
        if (mounted) {
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // refresh every 3 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && !metrics) {
    return (
      <div className="fade-in">
         <div className="page-header" style={{ marginBottom: "24px" }}>
           <h2 style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: "2rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
             <FiActivity style={{ color: "var(--primary)" }} /> System Performance
           </h2>
         </div>
         <div className="card admin-loading-state" style={{ minHeight: '300px' }}>
           <div className="spinner" />
           <p className="loading-text">Connecting to system monitor...</p>
         </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="fade-in">
         <div className="page-header" style={{ marginBottom: "24px" }}>
           <h2 style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: "2rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
             <FiActivity style={{ color: "var(--primary)" }} /> System Performance
           </h2>
         </div>
         <div className="error-card">
           <FiAlertCircle /> Failed to connect to performance monitoring. The backend API is not responding. 
           Please ensure the Python backend is running.
         </div>
      </div>
    );
  }

  const { system, api } = metrics;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ marginBottom: "0" }}>
        <h2 style={{
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: "clamp(1.4rem, 1.1rem + 0.8vw, 2rem)",
          fontWeight: 700,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          margin: 0
        }}>
          <FiActivity style={{ color: "var(--primary)" }} /> System Performance
        </h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "15px" }}>
          Real-time insights into server telemetry and API load monitoring.
        </p>
      </div>

      {/* Real-time System Usage */}
      <h3 style={{ 
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        fontSize: '1.25rem',
        margin: '12px 0 0 0',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <FiSettings style={{ color: 'var(--text-muted)' }} /> Live Host Telemetry
      </h3>
      
      <div className="stats-grid">
        {/* CPU */}
        <div className="stat-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon purple"><FiCpu /></div>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>CPU Usage</p>
                <h4 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{system.cpu_percent}%</h4>
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(192, 193, 255, 0.06)', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${system.cpu_percent}%`, 
              height: '100%', 
              background: system.cpu_percent > 85 ? 'var(--error)' : 'linear-gradient(90deg, var(--primary), var(--secondary))',
              transition: 'width 0.5s ease-out, background 0.5s ease-out'
            }} />
          </div>
        </div>

        {/* Memory */}
        <div className="stat-card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon blue"><FiHardDrive /></div>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Memory Util</p>
                <h4 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{system.memory_percent}%</h4>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {system.memory_used_mb} MB / {system.memory_total_mb} MB
            </div>
          </div>
          <div style={{ background: 'rgba(192, 193, 255, 0.06)', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${system.memory_percent}%`, 
              height: '100%', 
              background: system.memory_percent > 85 ? 'var(--error)' : 'linear-gradient(90deg, var(--primary), var(--secondary))',
              transition: 'width 0.5s ease-out, background 0.5s ease-out'
            }} />
          </div>
        </div>
      </div>

      {/* Network & API Load */}
      <h3 style={{ 
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        fontSize: '1.25rem',
        margin: '12px 0 0 0',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <FiActivity style={{ color: 'var(--secondary)' }} /> Network & Routing
      </h3>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><FiActivity /></div>
          <div className="stat-info">
            <h4>{api.total_requests}</h4>
            <p>Total API Requests</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><FiClock /></div>
          <div className="stat-info">
            <h4>{api.avg_latency_ms} ms</h4>
            <p>Avg Latency (Rolling)</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><FiAlertCircle /></div>
          <div className="stat-info">
            <h4>{api.error_rate_percent}%</h4>
            <p>Global Error Rate</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon blue"><FiClock /></div>
          <div className="stat-info">
            <h4>{(system.uptime_seconds / 3600).toFixed(2)}h</h4>
            <p>Server Uptime</p>
          </div>
        </div>
      </div>

    </div>
  );
}
