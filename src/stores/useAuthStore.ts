import { create } from 'zustand'
import type { User } from '../db/database'

interface AuthStore {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  logout: () => set({ currentUser: null }),
}))
