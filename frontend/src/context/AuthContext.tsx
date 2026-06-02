import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi } from '../services/api';
import type { LoginRequest, SignupRequest, DecodedToken } from '../types';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function getStoredToken(): string | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    const decoded = jwtDecode<DecodedToken>(token);
    // Check if token is expired
    if (decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('access_token');
      return null;
    }
    return token;
  } catch {
    localStorage.removeItem('access_token');
    return null;
  }
}

function getUserIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    return decoded.sub;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isNewUser, setIsNewUser] = useState(false);

  const userId = useMemo(() => getUserIdFromToken(token), [token]);
  const isAuthenticated = token !== null;

  const persistToken = useCallback((newToken: string) => {
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    persistToken(res.access_token);
    setIsNewUser(false);
  }, [persistToken]);

  const signup = useCallback(async (data: SignupRequest) => {
    const res = await authApi.signup(data);
    persistToken(res.access_token);
    setIsNewUser(true);
  }, [persistToken]);

  const googleLogin = useCallback(async (credential: string) => {
    const res = await authApi.googleLogin(credential);
    persistToken(res.access_token);
    setIsNewUser(false);
  }, [persistToken]);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setToken(null);
    setIsNewUser(false);
  }, []);

  const value = useMemo(() => ({
    token,
    userId,
    isAuthenticated,
    isNewUser,
    login,
    signup,
    googleLogin,
    logout,
  }), [token, userId, isAuthenticated, isNewUser, login, signup, googleLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
