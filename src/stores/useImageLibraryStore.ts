import { create } from 'zustand'
import { db } from '../db/database'

interface ImageLibraryItem {
  id: string
  name: string
  keywords: string
  dataUrl: string
  pinned: boolean
  createdAt: number
}

interface ImageLibraryStore {
  items: ImageLibraryItem[]
  loadItems: () => Promise<void>
  addItem: (item: Omit<ImageLibraryItem, 'id' | 'createdAt' | 'pinned'>) => Promise<void>
  addItems: (items: Omit<ImageLibraryItem, 'id' | 'createdAt' | 'pinned'>[]) => Promise<void>
  updateItem: (id: string, updates: Partial<Pick<ImageLibraryItem, 'name' | 'keywords'>>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
}

export const useImageLibraryStore = create<ImageLibraryStore>((set, get) => ({
  items: [],

  loadItems: async () => {
    const all = await db.imageLibrary.toArray()
    all.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.createdAt - a.createdAt
    })
    set({ items: all })
  },

  addItem: async (item) => {
    const now = Date.now()
    const newItem: ImageLibraryItem = { ...item, id: crypto.randomUUID(), pinned: false, createdAt: now }
    await db.imageLibrary.add(newItem)
    const { items } = get()
    set({ items: [newItem, ...items] })
  },

  addItems: async (items) => {
    const now = Date.now()
    const newItems: ImageLibraryItem[] = items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      pinned: false,
      createdAt: now,
    }))
    await db.imageLibrary.bulkAdd(newItems)
    const { items: existing } = get()
    set({ items: [...newItems, ...existing] })
  },

  updateItem: async (id, updates) => {
    await db.imageLibrary.update(id, updates)
    const { items } = get()
    set({ items: items.map(i => i.id === id ? { ...i, ...updates } : i) })
  },

  deleteItem: async (id) => {
    await db.imageLibrary.delete(id)
    const { items } = get()
    set({ items: items.filter(i => i.id !== id) })
  },

  togglePin: async (id) => {
    const { items } = get()
    const item = items.find(i => i.id === id)
    if (!item) return
    const newPinned = !item.pinned
    await db.imageLibrary.update(id, { pinned: newPinned })
    const updated = items.map(i => i.id === id ? { ...i, pinned: newPinned } : i)
    updated.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.createdAt - a.createdAt
    })
    set({ items: updated })
  },
}))
