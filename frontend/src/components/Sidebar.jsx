import React from "react";
import { NavLink } from "react-router-dom";
import { FiHome, FiSearch, FiBarChart2, FiInfo, FiUser, FiAperture, FiActivity } from "react-icons/fi";
import GradientText from "./GradientText";

function Sidebar({ isOpen, onClose, user }) {
  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? "open" : ""}`} style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--bg-primary)' }}>
        <div className="sidebar-brand" style={{ padding: '32px 24px', borderBottom: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--primary-container)', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
              <FiAperture style={{ color: 'var(--bg-primary)', fontSize: 20 }} />
            </div>
            <GradientText
              colors={['#c0c1ff', '#8083ff', '#c0c1ff']}
              animationSpeed={8}
            >
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'transparent' }}>
                LumiWeave
              </h1>
            </GradientText>
          </div>
          <p style={{ margin: '8px 0 0 0', paddingLeft: 40, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Precision Observer
          </p>
        </div>

        <nav className="sidebar-nav" onClick={onClose} style={{ padding: '12px 16px', gap: '8px' }}>
          <NavLink to="/" end className={({isActive}) => isActive ? "active" : ""}>
            <FiHome /> Dashboard
          </NavLink>
          <NavLink to="/detect" className={({isActive}) => isActive ? "active" : ""}>
            <FiSearch /> Detect Defect
          </NavLink>
          <NavLink to="/analytics" className={({isActive}) => isActive ? "active" : ""}>
            <FiBarChart2 /> Analytics
          </NavLink>
          <NavLink to="/performance" className={({isActive}) => isActive ? "active" : ""}>
            <FiActivity /> Performance
          </NavLink>
          <NavLink to="/about" className={({isActive}) => isActive ? "active" : ""}>
            <FiInfo /> Model Specs
          </NavLink>
        </nav>

        <div className="sidebar-footer" style={{ borderTop: 'none', padding: '24px 16px' }}>
          {user && (
            <NavLink to="/profile" className={({isActive}) => isActive ? "active" : ""} style={{ width: '100%', justifyContent: 'flex-start', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
              <FiUser /> Profile & Settings
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
