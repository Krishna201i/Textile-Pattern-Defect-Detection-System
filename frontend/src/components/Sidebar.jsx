import React from "react";
import { NavLink } from "react-router-dom";
import { FiGrid, FiSearch, FiBarChart2, FiInfo, FiCpu } from "react-icons/fi";
import ThemeToggle from "./ThemeToggle";

function Sidebar({ theme, setTheme, isOpen, onClose }) {
  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <h1>
            <FiCpu /> TextileGuard
          </h1>
          <p>AI Defect Detection</p>
        </div>

        <nav className="sidebar-nav" onClick={onClose}>
          <NavLink to="/" end>
            <FiGrid /> Dashboard
          </NavLink>
          <NavLink to="/detect">
            <FiSearch /> Detect
          </NavLink>
          <NavLink to="/analytics">
            <FiBarChart2 /> Analytics
          </NavLink>
          <NavLink to="/about">
            <FiInfo /> About Model
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
