import { create } from 'zustand';
import { api, UserResponse, clearLegacyTokens } from '@/lib/api';

interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  loginAsDemoUser: (role?: string) => void;
  logout: () => void;
  loadUser: () => Promise<void>;
  setUser: (user: UserResponse) => void;
}

const DEMO_USER_KEY = 'docintel_demo_session';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isDemoMode: false,

  setUser: (user: UserResponse) => {
    set({ user, isAuthenticated: true });
  },

  loginAsDemoUser: (role: string = 'ADMIN') => {
    const demoUser: UserResponse = {
      id: 'demo-enterprise-user',
      email: 'demo.reviewer@docintel.ai',
      full_name: 'Alex Vance (Lead Auditor)',
      role: role as any,
      created_at: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
      localStorage.setItem('doc_intel_token', 'demo-token-bypass');
    }
    set({ user: demoUser, isAuthenticated: true, isDemoMode: true });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DEMO_USER_KEY);
      }
      await api.login(email, password);
      await get().loadUser();
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email: string, password: string, name: string, role: string) => {
    set({ isLoading: true });
    try {
      await api.register(email, password, name, role);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    clearLegacyTokens();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_USER_KEY);
    }
    api.logout().catch(() => {});
    set({ user: null, isAuthenticated: false, isDemoMode: false });
  },

  loadUser: async () => {
    // Check if demo user session is saved in localStorage
    if (typeof window !== 'undefined') {
      const storedDemo = localStorage.getItem(DEMO_USER_KEY);
      if (storedDemo) {
        try {
          const parsed = JSON.parse(storedDemo);
          if (parsed && parsed.email) {
            set({ user: parsed, isAuthenticated: true, isDemoMode: true });
            return;
          }
        } catch {
          localStorage.removeItem(DEMO_USER_KEY);
        }
      }
    }

    try {
      const user = await api.getMe();
      set({ user, isAuthenticated: true, isDemoMode: false });
    } catch {
      set({ user: null, isAuthenticated: false, isDemoMode: false });
    }
  },
}));
