import { create } from 'zustand'

interface UIState {
  showPropertyPanel: boolean
  togglePropertyPanel: () => void
  setShowPropertyPanel: (show: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  showPropertyPanel: true,
  togglePropertyPanel: () => set((state) => ({ showPropertyPanel: !state.showPropertyPanel })),
  setShowPropertyPanel: (show: boolean) => set({ showPropertyPanel: show }),
}))
