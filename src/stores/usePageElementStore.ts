import { create } from 'zustand'
import type { PageElement, PageElementType } from '../types/element'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'

interface PageElementStore {
  elements: PageElement[]
  selectedElementIds: string[]
  activeTool: PageElementType | null

  loadElements: (pageId: string) => Promise<void>
  addElement: (pageId: string, type: PageElementType, position: { x: number; y: number }) => Promise<PageElement>
  updateElement: (id: string, updates: Partial<PageElement>) => Promise<void>
  deleteElement: (id: string) => Promise<void>
  selectElement: (id: string) => void
  clearSelection: () => void
  setActiveTool: (tool: PageElementType | null) => void
  duplicateElement: (id: string) => Promise<void>
}

export const usePageElementStore = create<PageElementStore>((set, get) => ({
  elements: [],
  selectedElementIds: [],
  activeTool: null,

  loadElements: async (pageId: string) => {
    const pageElements = await db.pageElements.where('pageId').equals(pageId).sortBy('zIndex')
    const { elements } = get()
    const others = elements.filter(e => e.pageId !== pageId)
    set({ elements: [...others, ...pageElements] })
  },

  addElement: async (pageId: string, type: PageElementType, position: { x: number; y: number }) => {
    const now = Date.now()
    const element: PageElement = {
      id: uuid(),
      pageId,
      type,
      position: { x: position.x, y: position.y },
      size: { width: type === 'line' || type === 'arrow' ? 200 : type === 'red-box' ? 75 : 200, height: type === 'line' || type === 'arrow' ? 2 : type === 'red-box' ? 40 : 60 },
      rotation: 0,
      style: type === 'red-box'
        ? { borderColor: '#ff0000', borderWidth: 3, fill: 'transparent' }
        : type === 'arrow' || type === 'line'
        ? { strokeColor: '#ff0000', strokeWidth: 2, hideArrowHead: false }
        : {},
      content: type === 'text' ? { text: '文本', fontSize: 16, color: '#000000', fontFamily: 'Arial', bold: false } : type === 'image' ? { src: '' } : {},
      zIndex: get().elements.length,
      createdAt: now,
      updatedAt: now,
    }
    await db.pageElements.add(element)
    const { elements } = get()
    set({ elements: [...elements, element], selectedElementIds: [element.id] })
    return element
  },

  updateElement: async (id: string, updates: Partial<PageElement>) => {
    await db.pageElements.update(id, { ...updates, updatedAt: Date.now() })
    const { elements } = get()
    set({ elements: elements.map(e => e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e) })
  },

  deleteElement: async (id: string) => {
    await db.pageElements.delete(id)
    const { elements, selectedElementIds } = get()
    set({
      elements: elements.filter(e => e.id !== id),
      selectedElementIds: selectedElementIds.filter(sid => sid !== id),
    })
  },

  duplicateElement: async (id: string) => {
    const { elements } = get()
    const src = elements.find(e => e.id === id)
    if (!src) return
    const now = Date.now()
    const dup: PageElement = {
      ...src,
      id: uuid(),
      position: { x: src.position.x + 10, y: src.position.y + 10 },
      zIndex: elements.length,
      createdAt: now,
      updatedAt: now,
    }
    await db.pageElements.add(dup)
    set({ elements: [...elements, dup], selectedElementIds: [dup.id] })
  },

  selectElement: (id: string) => {
    set({ selectedElementIds: [id] })
  },

  clearSelection: () => {
    set({ selectedElementIds: [] })
  },

  setActiveTool: (tool: PageElementType | null) => {
    set({ activeTool: tool })
  },
}))
