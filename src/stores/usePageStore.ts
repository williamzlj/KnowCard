import { create } from 'zustand'
import type { Page, PageMargins, PageSize, PageOrientation, PageNumberSettings, FooterSettings, WatermarkSettings } from '../types/page'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'

const defaultMargins: PageMargins = { top: 15, bottom: 15, left: 15, right: 15 }

const defaultPageNumber: PageNumberSettings = {
  enabled: true,
  position: 'bottom-center',
  font: 'Arial',
  color: '#000000',
  size: 12,
}

const defaultFooter: FooterSettings = {
  enabled: false,
  text: '',
  font: 'Arial',
  color: '#000000',
  size: 10,
  position: 'center',
}

const defaultWatermark: WatermarkSettings = {
  enabled: false,
  text: '',
  fontSize: 48,
  opacity: 0.1,
  density: 3,
  spacing: 100,
  color: '#000000',
}

interface PageStore {
  pages: Page[]
  currentPageId: string | null
  isLoading: boolean

  loadPages: (projectId: string) => Promise<void>
  createPage: (projectId: string, name?: string) => Promise<Page>
  deletePage: (id: string) => Promise<void>
  reorderPages: (pageIds: string[]) => Promise<void>
  setCurrentPage: (id: string) => void
  updatePage: (id: string, updates: Partial<Page>) => Promise<void>
  getCurrentPage: () => Page | undefined
}

export const usePageStore = create<PageStore>((set, get) => ({
  pages: [],
  currentPageId: null,
  isLoading: false,

  loadPages: async (projectId: string) => {
    let pages = await db.pages.where('projectId').equals(projectId).sortBy('order')
    for (const p of pages) {
      if (p.cardMinHSpacing === undefined && (p as unknown as Record<string, unknown>).cardMinSpacing !== undefined) {
        const old = (p as unknown as Record<string, unknown>).cardMinSpacing as number
        p.cardMinHSpacing = old
        p.cardMinVSpacing = old
        await db.pages.update(p.id, { cardMinHSpacing: old, cardMinVSpacing: old })
      }
    }
    if (pages.length === 0) {
      const now = Date.now()
      const defaultPage: Page = {
        id: uuid(),
        projectId,
        name: '页面 1',
        size: 'A4',
        orientation: 'portrait',
        margins: defaultMargins,
        pageNumber: defaultPageNumber,
        footer: defaultFooter,
        watermark: defaultWatermark,
        cardMinHSpacing: 5,
        cardMinVSpacing: 5,
        order: 0,
        backgroundColor: '#ffffff',
        createdAt: now,
        updatedAt: now,
      }
      await db.pages.add(defaultPage)
      set({ pages: [defaultPage], currentPageId: defaultPage.id })
      return
    }
    const prevId = get().currentPageId
    set({ pages, currentPageId: pages.find(p => p.id === prevId) ? prevId : pages[0]?.id || null })
  },

  createPage: async (projectId: string, name?: string) => {
    const { currentPageId } = get()
    const pages = await db.pages.where('projectId').equals(projectId).sortBy('order')
    const currentPage = pages.find(p => p.id === currentPageId)
    const insertOrder = currentPage != null ? currentPage.order + 1 : pages.length
    const now = Date.now()
    const page: Page = {
      id: uuid(),
      projectId,
      name: '',
      size: 'A4' as PageSize,
      orientation: 'portrait' as PageOrientation,
      margins: defaultMargins,
      pageNumber: defaultPageNumber,
      footer: defaultFooter,
      watermark: defaultWatermark,
      cardMinHSpacing: 5,
      cardMinVSpacing: 5,
      order: insertOrder,
      backgroundColor: '#ffffff',
      createdAt: now,
      updatedAt: now,
    }
    await db.pages.add(page)
    const allPages = await db.pages.where('projectId').equals(projectId).sortBy('order')
    for (let i = 0; i < allPages.length; i++) {
      const p = allPages[i]
      const pageName = p.id === page.id && name ? name : `页面 ${i + 1}`
      if (p.name !== pageName || p.order !== i) {
        await db.pages.update(p.id, { name: pageName, order: i, updatedAt: now })
      }
    }
    await get().loadPages(projectId)
    set({ currentPageId: page.id })
    return page
  },

  deletePage: async (id: string) => {
    const page = await db.pages.get(id)
    if (!page) return
    const projectId = page.projectId
    await db.pages.delete(id)
    await db.cards.where('pageId').equals(id).delete()
    await db.pageElements.where('pageId').equals(id).delete()
    const { currentPageId, pages } = get()
    if (currentPageId === id) {
      const remaining = pages.filter(p => p.id !== id)
      set({ currentPageId: remaining[0]?.id || null })
    }
    const allPages = await db.pages.where('projectId').equals(projectId).sortBy('order')
    for (let i = 0; i < allPages.length; i++) {
      await db.pages.update(allPages[i].id, { name: `页面 ${i + 1}`, updatedAt: Date.now() })
    }
    await get().loadPages(projectId)
  },

  reorderPages: async (pageIds: string[]) => {
    for (let i = 0; i < pageIds.length; i++) {
      await db.pages.update(pageIds[i], { order: i, updatedAt: Date.now() })
    }
    const { pages } = get()
    const projectId = pages[0]?.projectId || ''
    await get().loadPages(projectId)
  },

  setCurrentPage: (id: string) => {
    set({ currentPageId: id })
  },

  updatePage: async (id: string, updates: Partial<Page>) => {
    await db.pages.update(id, { ...updates, updatedAt: Date.now() })
    const { pages } = get()
    const projectId = pages[0]?.projectId || ''
    await get().loadPages(projectId)
  },

  getCurrentPage: () => {
    const { pages, currentPageId } = get()
    return pages.find(p => p.id === currentPageId)
  },
}))
