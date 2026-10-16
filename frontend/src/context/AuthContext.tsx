import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, RegisterRequest, UserProfileUpdate } from '../types';
import { api, getAuthToken, setAuthToken, removeAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (ident: string, pass: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; reset_token?: string }>;
  resetPassword: (token: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (data: UserProfileUpdate) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await api.getCurrentUser();
      setUser(profile);
    } catch {
      removeAuthToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const login = async (ident: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(ident, pass);
      setAuthToken(res.access_token);
      await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      setAuthToken(res.access_token);
      await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    return await api.forgotPassword(email);
  };

  const resetPassword = async (token: string, newPass: string) => {
    return await api.resetPassword(token, newPass);
  };

  const updateProfile = async (data: UserProfileUpdate) => {
    const updated = await api.updateProfile(data);
    setUser(updated);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    } finally {
      removeAuthToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isLoading,
        login,
        register,
        forgotPassword,
        resetPassword,
        updateProfile,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
