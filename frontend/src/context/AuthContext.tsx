import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi, userApi } from '../services/api';
import type { LoginRequest, SignupRequest, SignupPendingResponse, OTPVerifyRequest, DecodedToken, UserProfile } from '../types';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  user: UserProfile | null;
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<SignupPendingResponse>;
  verifyOtp: (data: OTPVerifyRequest) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
  const [user, setUser] = useState<UserProfile | null>(null);

  const userId = useMemo(() => getUserIdFromToken(token), [token]);
  const isAuthenticated = token !== null;

  const persistToken = useCallback((newToken: string) => {
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
  }, []);

  // Fetch user profile when token is available
  const refreshUser = useCallback(async () => {
    try {
      const profile = await userApi.getMe();
      setUser(profile);
    } catch {
      // If we can't fetch user profile, don't crash — just leave it null
      setUser(null);
    }
  }, []);

  // Auto-fetch user profile on mount and when token changes
  useEffect(() => {
    if (token) {
      refreshUser();
    } else {
      setUser(null);
    }
  }, [token, refreshUser]);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    persistToken(res.access_token);
    setIsNewUser(false);
  }, [persistToken]);

  /**
   * Signup now returns SignupPendingResponse (no token).
   * The caller (Auth.tsx) should show the OTP modal after this.
   */
  const signup = useCallback(async (data: SignupRequest): Promise<SignupPendingResponse> => {
    const res = await authApi.signup(data);
    setIsNewUser(true);
    return res;
  }, []);

  /**
   * Step 2 of signup: verify OTP and receive JWT.
   */
  const verifyOtp = useCallback(async (data: OTPVerifyRequest) => {
    const res = await authApi.verifyOtp(data);
    persistToken(res.access_token);
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
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    token,
    userId,
    isAuthenticated,
    isNewUser,
    user,
    login,
    signup,
    verifyOtp,
    googleLogin,
    logout,
    refreshUser,
  }), [token, userId, isAuthenticated, isNewUser, user, login, signup, verifyOtp, googleLogin, logout, refreshUser]);

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
