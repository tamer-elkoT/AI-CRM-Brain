/**
 * App.tsx — Rabih CRM Root
 *
 * Splash screen strategy:
 *  INITIAL LOAD: 2.2s guaranteed splash plays on first app load.
 *  AUTH EVENTS:  Auth.tsx calls triggerSplash() on successful login/signup
 *                to show a 1.5s transition splash before navigating to /home.
 *
 * Two-phase unmounting pattern:
 *  - isVisible (false) → triggers CSS fade-out animation
 *  - isMounted (false) → removes element from DOM after fade
 *
 * Z-index hierarchy:
 *   SplashScreen      z-[200]   ← top of everything
 *   Modals / Drawers  z-[70-80]
 *   AppLayout header  z-[60]
 *   Page headers      z-20
 */

import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeProvider';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import SplashScreen from './components/SplashScreen';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Team from './pages/Team';
import { ToastProvider } from './components/ui/Toast';

// ─────────────────────────────────────────────────────────────
// SplashContext — lets child components (Auth page) trigger
// a new splash animation programmatically on login/signup.
// ─────────────────────────────────────────────────────────────
interface SplashContextValue {
  /** Call this before navigating to /home after auth to show a transition splash */
  triggerSplash: (durationMs?: number) => Promise<void>;
}

const SplashContext = createContext<SplashContextValue>({
  triggerSplash: () => Promise.resolve(),
});

export function useSplash() {
  return useContext(SplashContext);
}

/** Minimum splash duration in ms on initial page load */
const INITIAL_SPLASH_MS = 2200;

// ─────────────────────────────────────────────────────────────
// SplashController — manages all splash state, renders
// SplashScreen, and exposes triggerSplash via context.
// ─────────────────────────────────────────────────────────────
function SplashController({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isMounted, setIsMounted] = useState(true);
  const [message,   setMessage]   = useState('Initializing AI Intelligence Engine…');

  // ── INITIAL LOAD SPLASH ──────────────────────────────────
  useEffect(() => {
    const start = Date.now();
    const remaining = Math.max(0, INITIAL_SPLASH_MS - (Date.now() - start));
    const timer = setTimeout(() => setIsVisible(false), remaining);
    return () => clearTimeout(timer);
  }, []);

  // ── AUTH-TRIGGERED SPLASH ────────────────────────────────
  /**
   * triggerSplash — shows a branded splash for `durationMs` ms.
   * Returns a Promise that resolves when the fade-out begins,
   * so Auth.tsx can navigate() immediately at that point.
   */
  const triggerSplash = useCallback((durationMs = 1500): Promise<void> => {
    return new Promise((resolve) => {
      setMessage('Signing you in to Rabih CRM…');
      setIsMounted(true);
      setIsVisible(true);
      setTimeout(() => {
        setIsVisible(false);
        resolve();
      }, durationMs);
    });
  }, []);

  return (
    <SplashContext.Provider value={{ triggerSplash }}>
      {isMounted && (
        <SplashScreen
          isVisible={isVisible}
          onDone={() => setIsMounted(false)}
          message={message}
        />
      )}
      {children}
    </SplashContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// App — root component
// ─────────────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          {/*
           * SplashController wraps the entire router so both Auth and
           * protected pages can access useSplash() via context.
           */}
          <SplashController>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/signup/team" element={<Auth />} />
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />
                {/* Protected app routes with shared sidebar layout */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/home"         element={<Home />} />
                  <Route path="/dashboard"    element={<Dashboard />} />
                  <Route path="/analytics"    element={<Analytics />} />
                  <Route path="/integrations" element={<Integrations />} />
                  <Route path="/settings"     element={<Settings />} />
                  <Route path="/team"         element={<Team />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SplashController>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
