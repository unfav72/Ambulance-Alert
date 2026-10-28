import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/index.js';
import { api, setToken, clearToken } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(localStorage.getItem('ambulance_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('ambulance_token');
    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.getMe();
      setUser(response.user);
    } catch {
      clearToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      setTokenState(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials: any) => {
    const data = await api.login(credentials);
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  };

  const register = async (userData: any) => {
    const data = await api.register(userData);
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        hasRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
