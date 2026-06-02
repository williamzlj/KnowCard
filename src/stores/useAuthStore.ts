import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../db/database'

interface AuthStore {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
    }),
    {
      name: 'knowcard-auth-storage',
    }
  )
)
