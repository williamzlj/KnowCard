import { create } from 'zustand'
import { db } from '../db/database'

interface RegexPresetItem {
  id: string
  name: string
  description: string
  pattern: string
  replace: string
  pinned: boolean
  createdAt: number
}

interface RegexLibraryStore {
  items: RegexPresetItem[]
  loadItems: () => Promise<void>
  addItem: (item: Omit<RegexPresetItem, 'id' | 'createdAt' | 'pinned'>) => Promise<void>
  updateItem: (id: string, updates: Partial<Omit<RegexPresetItem, 'id' | 'createdAt'>>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
}

export const useRegexLibraryStore = create<RegexLibraryStore>((set, get) => ({
  items: [],

  loadItems: async () => {
    const all = await db.regexPresets.toArray()
    all.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.createdAt - a.createdAt
    })
    set({ items: all })
  },

  addItem: async (item) => {
    const now = Date.now()
    const newItem: RegexPresetItem = { ...item, id: crypto.randomUUID(), pinned: false, createdAt: now }
    await db.regexPresets.add(newItem)
    const { items } = get()
    set({ items: [newItem, ...items] })
  },

  updateItem: async (id, updates) => {
    await db.regexPresets.update(id, updates)
    const { items } = get()
    set({ items: items.map(i => i.id === id ? { ...i, ...updates } : i) })
  },

  deleteItem: async (id) => {
    await db.regexPresets.delete(id)
    const { items } = get()
    set({ items: items.filter(i => i.id !== id) })
  },

  togglePin: async (id) => {
    const { items } = get()
    const item = items.find(i => i.id === id)
    if (!item) return
    const newPinned = !item.pinned
    await db.regexPresets.update(id, { pinned: newPinned })
    const updated = items.map(i => i.id === id ? { ...i, pinned: newPinned } : i)
    updated.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.createdAt - a.createdAt
    })
    set({ items: updated })
  },
}))
