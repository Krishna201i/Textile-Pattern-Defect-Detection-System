import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { FiHome, FiSearch, FiBarChart2, FiInfo } from "react-icons/fi";
import Dock from "./components/Dock";
import GradientText from "./components/GradientText";
import Dashboard from "./pages/Dashboard";
import DetectPage from "./pages/DetectPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminPage from "./pages/AdminPage";
import { fetchHistory, savePrediction, clearAllPredictions } from "./firebaseService";
import { onAuthChange, signOut, isAdmin } from './authService';
import ProtectedRoute from './components/ProtectedRoute';

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
  const [user, setUser] = useState(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (u) {
        isAdmin(u.uid).then((v) => setIsAdminUser(v)).catch(() => setIsAdminUser(false));
      } else {
        setIsAdminUser(false);
      }
    });
    return unsub;
  }, []);

  // Load history only when authenticated user is available
  useEffect(() => {
    async function loadHistory() {
      if (!user) {
        setHistory([]);
        return;
      }

      try {
        const data = await fetchHistory();
        setHistory(data);
      } catch (err) {
        console.error('Failed to load history:', err);
        setHistory([]);
      }
    }
    loadHistory();
  }, [user]);

  // Save to storage, then update local state
  const addToHistory = async (entry) => {
    try {
      const saved = await savePrediction(entry);
      if (saved) {
        setHistory((prev) => [...prev, saved]);
      } else {
        setHistory((prev) => [...prev, entry]);
      }
    } catch (err) {
      console.error('Failed to save history entry:', err);
      setHistory((prev) => [...prev, entry]);
    }
  };

  // Clear from storage, then clear local state
  const clearHistory = async () => {
    try {
      const success = await clearAllPredictions();
      if (success) {
        setHistory([]);
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <BrowserRouter>
      <div className="professional-bg" />

      <div className="app-layout">
        {/* Simple header with sign-in state */}
        <header className="app-header" style={{ width: '100%', maxWidth: 1200, padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GradientText
              className="app-brand-gradient"
              colors={['#7aa2ff', '#bcd3ff', '#d9e5ff']}
              animationSpeed={10}
              direction="horizontal"
            >
              <h1 style={{ margin: 0, fontSize: 16 }}>TextileGuard</h1>
            </GradientText>
            <small style={{ color: 'var(--text-muted)' }}>{user ? user.email : 'Not signed in'}</small>
          </div>

          <div>
            {user ? (
              <>
                {isAdminUser && <a href="/admin" className="btn btn-sm" style={{ marginRight: 8 }}>Admin</a>}
                <button className="btn btn-sm" onClick={() => signOut()}>Sign out</button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <a href="/login" className="btn btn-sm">Sign in</a>
                <a href="/signup" className="btn btn-sm btn-success">Sign up</a>
              </div>
            )}
          </div>
        </header>

        <Routes>
          <Route path="/login" element={<LoginPage onLogin={(u) => setUser(u)} />} />
          <Route path="/signup" element={<SignupPage onSignup={(u) => setUser(u)} />} />
          <Route path="/admin" element={isAdminUser ? <AdminPage /> : <Navigate to="/" />} />

          {/* Protected main app routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <AppContent history={history} addToHistory={addToHistory} clearHistory={clearHistory} />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
