import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { FiHome, FiSearch, FiBarChart2, FiInfo, FiUser } from "react-icons/fi";
import Dock from "./components/Dock";
import GradientText from "./components/GradientText";
import Dashboard from "./pages/Dashboard";
import DetectPage from "./pages/DetectPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AboutPage from "./pages/AboutPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminPage from "./pages/AdminPage";
import { fetchHistory, savePrediction, clearAllPredictions } from "./firebaseService";
import { onAuthChange, signOut, isAdmin } from './authService';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent({ history, addToHistory, clearHistory, user, onProfileUpdated }) {
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
    },
    {
      icon: <FiUser />,
      label: "Profile",
      onClick: () => navigate("/profile"),
      className: location.pathname === "/profile" ? "active" : ""
    }
  ];

  return (
    <>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard history={history} user={user} />} />
          <Route path="/detect" element={<DetectPage onResult={addToHistory} />} />
          <Route path="/analytics" element={<AnalyticsPage history={history} onClearHistory={clearHistory} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/profile" element={<ProfilePage user={user} history={history} onProfileUpdated={onProfileUpdated} />} />
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

function AdminAutoRedirect({ isAdminUser, authReady, adminCheckReady }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authReady || !adminCheckReady || !isAdminUser) return;

    if (["/", "/login", "/signup"].includes(location.pathname)) {
      navigate("/admin", { replace: true });
    }
  }, [authReady, adminCheckReady, isAdminUser, location.pathname, navigate]);

  return null;
}

function App() {
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminCheckReady, setAdminCheckReady] = useState(false);

  useEffect(() => {
    // Remove any stale data-theme attribute for dark-first design
    document.documentElement.removeAttribute("data-theme");
  }, []);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (u) {
        setAdminCheckReady(false);
        isAdmin(u.uid)
          .then((v) => setIsAdminUser(v))
          .catch(() => setIsAdminUser(false))
          .finally(() => setAdminCheckReady(true));
      } else {
        setIsAdminUser(false);
        setAdminCheckReady(true);
      }
      setAuthReady(true);
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

  const handleProfileUpdated = (updatedUser) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        displayName: updatedUser?.displayName || '',
        photoURL: updatedUser?.photoURL || '',
      };
    });
  };

  return (
    <BrowserRouter>
      <div className="professional-bg" />

      <AdminAutoRedirect
        isAdminUser={isAdminUser}
        authReady={authReady}
        adminCheckReady={adminCheckReady}
      />

      <div className="app-layout">
        {/* Simple header with sign-in state */}
        <header className="app-header" style={{ width: '100%', maxWidth: 1200, padding: '12px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <GradientText
              className="app-brand-gradient"
              colors={['#F5A623', '#E09000', '#F5A623']}
              animationSpeed={10}
              direction="horizontal"
            >
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>TextileGuard</h1>
            </GradientText>
            {user && (
              <span style={{
                padding: '4px 12px',
                borderRadius: '999px',
                background: 'rgba(245,166,35,0.08)',
                border: '1px solid rgba(245,166,35,0.1)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>
                {user.displayName || user.email}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <button className="btn btn-outline btn-sm" onClick={() => signOut()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                Sign out
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/login" className="btn btn-outline btn-sm">Sign in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Sign up</Link>
              </div>
            )}
          </div>
        </header>

        <Routes>
          <Route path="/login" element={<LoginPage onLogin={(u) => setUser(u)} />} />
          <Route path="/signup" element={<SignupPage onSignup={(u) => setUser(u)} />} />
          <Route
            path="/admin"
            element={
              !authReady || !adminCheckReady
                ? (
                  <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
                    <div className="spinner" />
                    <p className="loading-text">Checking admin access...</p>
                  </div>
                )
                : (
                  user
                    ? (
                      isAdminUser
                        ? <AdminPage />
                        : (
                          <div className="card" style={{ marginTop: 24, maxWidth: 720, textAlign: 'center' }}>
                            <h3 style={{ marginBottom: 8 }}>Admin Access Required</h3>
                            <p className="loading-text" style={{ marginBottom: 12 }}>
                              This account is not mapped as admin. Add your user in Firestore `admins` collection
                              or set `VITE_ADMIN_EMAILS` in frontend environment.
                            </p>
                            <Link to="/" className="btn btn-sm">Go to Dashboard</Link>
                          </div>
                        )
                    )
                    : <Navigate to="/login" replace />
                )
            }
          />

          {/* Protected main app routes */}
          <Route path="/*" element={
            <ProtectedRoute user={user} authReady={authReady}>
              <AppContent
                history={history}
                addToHistory={addToHistory}
                clearHistory={clearHistory}
                user={user}
                onProfileUpdated={handleProfileUpdated}
              />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
