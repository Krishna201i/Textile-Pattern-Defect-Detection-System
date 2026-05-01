import React from "react";
import { NavLink } from "react-router-dom";
import { FiHome, FiSearch, FiBarChart2, FiInfo, FiUser, FiAperture, FiShield, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import GradientText from "./GradientText";

function Sidebar({ isOpen, onClose, user, isAdminUser, isMinimized, onToggleMinimize }) {
  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? "open" : ""} ${isMinimized ? "minimized" : ""}`} style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--bg-primary)' }}>
        <div className="sidebar-brand" style={{ padding: '32px 24px', borderBottom: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--primary-container)', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
              <FiAperture style={{ color: 'var(--bg-primary)', fontSize: 20 }} />
            </div>
            <div className="sidebar-text">
              <GradientText
                colors={['#c0c1ff', '#8083ff', '#c0c1ff']}
                animationSpeed={8}
              >
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'transparent' }}>
                  LumiWeave
                </h1>
              </GradientText>
            </div>
          </div>
          <p className="sidebar-text sidebar-subtitle" style={{ margin: '8px 0 0 0', paddingLeft: 40, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Precision Observer
          </p>
        </div>

        <nav className="sidebar-nav" onClick={onClose} style={{ padding: '12px 16px', gap: '8px' }}>
          <NavLink to="/" end className={({isActive}) => isActive ? "active" : ""} title="Dashboard">
            <FiHome style={{ minWidth: 18 }} /> <span className="sidebar-text">Dashboard</span>
          </NavLink>
          
          <NavLink to="/detect" className={({isActive}) => isActive ? "active" : ""} title="Detect Defect">
            <FiSearch style={{ minWidth: 18 }} /> <span className="sidebar-text">Detect Defect</span>
          </NavLink>

          {isAdminUser && (
            <NavLink to="/admin" className={({isActive}) => isActive ? "active" : ""} title="Admin Portal">
              <FiShield style={{ minWidth: 18 }} /> <span className="sidebar-text">Admin Portal</span>
            </NavLink>
          )}

          {isAdminUser && (
            <NavLink to="/admin" className={({isActive}) => isActive ? "active" : ""} title="System Analytics">
              <FiBarChart2 style={{ minWidth: 18 }} /> <span className="sidebar-text">Analytics</span>
            </NavLink>
          )}

          <NavLink to="/about" className={({isActive}) => isActive ? "active" : ""} title="Model Specs">
            <FiInfo style={{ minWidth: 18 }} /> <span className="sidebar-text">Model Specs</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer" style={{ borderTop: 'none', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {user && (
            <NavLink to="/profile" className={({isActive}) => isActive ? "active" : ""} title="Profile & Settings">
              <FiUser style={{ minWidth: 18 }} /> <span className="sidebar-text">Profile</span>
            </NavLink>
          )}
          <button 
            className="sidebar-collapse-btn" 
            onClick={(e) => { e.stopPropagation(); onToggleMinimize(); }} 
            title={isMinimized ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isMinimized ? <FiChevronRight style={{ minWidth: 18 }} /> : <FiChevronLeft style={{ minWidth: 18 }} />}
            <span className="sidebar-text">Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
