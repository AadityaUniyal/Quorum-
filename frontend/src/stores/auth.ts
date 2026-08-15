import { create } from 'zustand'
import { api, UserResponse, clearLegacyTokens } from '@/lib/api'

interface AuthState {
  user: UserResponse | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, role: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  setUser: (user: UserResponse) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user: UserResponse) => {
    set({ user, isAuthenticated: true })
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      await api.login(email, password)
      clearLegacyTokens()
      await get().loadUser()
    } finally {
      set({ isLoading: false })
    }
  },

  register: async (email: string, password: string, name: string, role: string) => {
    set({ isLoading: true })
    try {
      await api.register(email, password, name, role)
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    clearLegacyTokens()
    api.logout().catch(console.error)
    set({ user: null, isAuthenticated: false })
  },

  loadUser: async () => {
    try {
      const user = await api.getMe()
      set({ user, isAuthenticated: true })
    } catch {
      set({ user: null, isAuthenticated: false })
    }
  },
}))
