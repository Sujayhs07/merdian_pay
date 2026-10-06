import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  type UserProfile,
  getStoredUser,
  fetchCurrentUser,
  loginWithCredentials,
  registerWithCredentials,
  loginWithWalletAddress,
  clearAuthSession,
  updateProfile as updateProfileApi,
  loginDemoGuest,
} from "./auth";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (params: { email: string; password: string }) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    businessName?: string;
    settlementAddress?: string;
  }) => Promise<void>;
  loginWithWallet: (walletAddress: string, businessName?: string) => Promise<void>;
  loginAsGuest: (walletAddress?: string) => Promise<void>;
  logout: () => void;
  updateUserProfile: (params: {
    businessName?: string;
    settlementAddress?: string | null;
    password?: string;
  }) => Promise<UserProfile>;
  updateUserSettlement: (address: string, password?: string) => Promise<void>;
  updateBusinessName: (name: string, password?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const current = await fetchCurrentUser();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (params: { email: string; password: string }) => {
    const res = await loginWithCredentials(params);
    setUser(res.user);
  };

  const register = async (params: {
    email: string;
    password: string;
    businessName?: string;
    settlementAddress?: string;
  }) => {
    const res = await registerWithCredentials(params);
    setUser(res.user);
  };

  const loginWithWallet = async (walletAddress: string, businessName?: string) => {
    const res = await loginWithWalletAddress({ walletAddress, businessName });
    setUser(res.user);
  };

  const loginAsGuest = async (walletAddress?: string) => {
    const res = await loginDemoGuest(walletAddress);
    setUser(res.user);
  };

  const logout = () => {
    clearAuthSession();
    setUser(null);
  };

  const updateUserProfile = async (params: {
    businessName?: string;
    settlementAddress?: string | null;
    password?: string;
  }) => {
    const updated = await updateProfileApi(params);
    setUser(updated);
    return updated;
  };

  const updateUserSettlement = async (address: string, password?: string) => {
    const updated = await updateProfileApi({ settlementAddress: address, password });
    setUser(updated);
  };

  const updateBusinessName = async (name: string, password?: string) => {
    const updated = await updateProfileApi({ businessName: name, password });
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithWallet,
        loginAsGuest,
        logout,
        updateUserProfile,
        updateUserSettlement,
        updateBusinessName,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
