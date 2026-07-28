import React, { createContext, useContext, useState, ReactNode } from 'react';
import { KeyPair } from '../../domain/identity/IIdentityUseCase';

interface AuthState {
  identity: KeyPair | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (identity: KeyPair) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    identity: null,
    isAuthenticated: false,
  });

  const login = (identity: KeyPair) => {
    setAuthState({
      identity,
      isAuthenticated: true,
    });
  };

  const logout = () => {
    setAuthState({
      identity: null,
      isAuthenticated: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
