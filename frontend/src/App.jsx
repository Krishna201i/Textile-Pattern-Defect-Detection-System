import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { FiHome, FiSearch, FiBarChart2, FiInfo } from "react-icons/fi";
import Galaxy from "./components/Galaxy";
import Dock from "./components/Dock";
import Dashboard from "./pages/Dashboard";
import DetectPage from "./pages/DetectPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AboutPage from "./pages/AboutPage";
import { fetchHistory, savePrediction, clearAllPredictions } from "./supabaseService";

function AppContent({ history, addToHistory, clearHistory }) {
  const navigate = useNavigate();
  const location = useLocation();

  const dockItems = [
    {
      icon: <FiHome />,
      label: "Dashboard",
      onClick: () => navigate("/"),
      className: location.pathname === "/" ? "active" : ""
    },
    {
      icon: <FiSearch />,
      label: "Detect",
      onClick: () => navigate("/detect"),
      className: location.pathname === "/detect" ? "active" : ""
    },
    {
      icon: <FiBarChart2 />,
      label: "Analytics",
      onClick: () => navigate("/analytics"),
      className: location.pathname === "/analytics" ? "active" : ""
    },
    {
      icon: <FiInfo />,
      label: "About",
      onClick: () => navigate("/about"),
      className: location.pathname === "/about" ? "active" : ""
    }
  ];

  return (
    <>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard history={history} />} />
          <Route path="/detect" element={<DetectPage onResult={addToHistory} />} />
          <Route path="/analytics" element={<AnalyticsPage history={history} onClearHistory={clearHistory} />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <div className="dock-wrapper">
        <Dock
          items={dockItems}
          panelHeight={68}
          baseItemSize={50}
          magnification={70}
        />
      </div>
    </>
  );
}

function App() {
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load history from Supabase on app start
  useEffect(() => {
    async function loadHistory() {
      const data = await fetchHistory();
      setHistory(data);
    }
    loadHistory();
  }, []);

  // Save to Supabase, then update local state
  const addToHistory = async (entry) => {
    const saved = await savePrediction(entry);
    if (saved) {
      setHistory((prev) => [...prev, saved]);
    } else {
      // Fallback: add to local state so UI stays responsive
      setHistory((prev) => [...prev, entry]);
    }
  };

  // Clear from Supabase, then clear local state
  const clearHistory = async () => {
    const success = await clearAllPredictions();
    if (success) {
      setHistory([]);
    }
  };

  return (
    <BrowserRouter>
      {/* Galaxy background — covers entire viewport */}
      <div className="galaxy-bg">
        <Galaxy
          hueShift={270}
          speed={0.6}
          density={1.2}
          saturation={0.4}
          glowIntensity={0.4}
          starSpeed={0.3}
          twinkleIntensity={0.4}
          rotationSpeed={0.05}
          mouseRepulsion={false}
          transparent={false}
        />
      </div>

      <div className="app-layout">
        <AppContent
          history={history}
          addToHistory={addToHistory}
          clearHistory={clearHistory}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
