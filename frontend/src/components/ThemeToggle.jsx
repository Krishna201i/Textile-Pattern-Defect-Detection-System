import React from "react";
import { FiSun, FiMoon } from "react-icons/fi";

function ThemeToggle({ theme, setTheme }) {
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <button className="theme-toggle" onClick={toggle}>
      {theme === "dark" ? <FiSun /> : <FiMoon />}
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}

export default ThemeToggle;
