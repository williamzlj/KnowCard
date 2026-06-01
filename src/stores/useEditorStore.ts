import { create } from 'zustand'

interface EditorStore {
  isOpen: boolean
  cardId: string | null
  elementId: string | null

  openCardEditor: (cardId: string) => void
  openElementEditor: (elementId: string) => void
  closeEditor: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  isOpen: false,
  cardId: null,
  elementId: null,

  openCardEditor: (cardId: string) => {
    set({ isOpen: true, cardId, elementId: null })
  },

  openElementEditor: (elementId: string) => {
    set({ isOpen: true, cardId: null, elementId })
  },

  closeEditor: () => {
    set({ isOpen: false, cardId: null, elementId: null })
  },
}))
