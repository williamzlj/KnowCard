import { create } from 'zustand'
import type { Card, CardStyle, CardFlags, CardGroup } from '../types/card'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'
import { calcCardSize } from '../utils/cardSize'
import { getSafeArea } from '../types/page'

const defaultCardStyle: CardStyle = {
  titleFont: '黑体',
  titleFontSize: 14,
  titleBold: true,
  titleColor: '#000000',
  titleBackgroundColor: '#e8f4fd',
  titlePaddingY: 4,
  titleNumberStyle: 'number-dot',
  bodyFont: '宋体',
  bodyFontSize: 13,
  bodyColor: '#333333',
  bodyBackgroundColor: '#ffffff',
  bodyLineHeight: 1.5,
  paddingX: 10,
  borderColor: '#4a90d9',
  borderWidth: 1,
  borderRadius: 4,
}

const defaultCardFlags: CardFlags = {
  hideBorder: false,
  hideTitle: false,
  hideBody: false,
    hideBodyArea: false,
    showNumber: false,
  hideTitleText: false,
  excludeFromLayout: false,
  excludeFromNumbering: false,
}

interface CardStore {
  cards: Card[]
  cardGroups: CardGroup[]
  selectedCardIds: string[]
  searchQuery: string
  isLoading: boolean

  loadCards: (projectId: string) => Promise<void>
  loadCardGroups: (projectId: string) => Promise<void>
  createCard: (projectId: string, pageId: string) => Promise<Card>
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  deleteCards: (ids: string[]) => Promise<void>
  duplicateCard: (id: string, toPageId?: string) => Promise<void>
  reorderCards: (cardIds: string[]) => Promise<void>
  renumberCard: (cardId: string, newNumber: number) => Promise<void>
  toggleCardSelection: (id: string) => void
  selectAllCards: () => void
  clearSelection: () => void
  setSearchQuery: (query: string) => void

  createCardGroup: (projectId: string, name: string) => Promise<void>
  deleteCardGroup: (id: string) => Promise<void>
  renameCardGroup: (id: string, name: string) => Promise<void>
  setCardGroup: (cardId: string, groupId: string) => Promise<void>

  copyCardStyle: (cardId: string) => CardStyle | null
  pasteCardStyle: (cardId: string) => Promise<void>
  applyStyleToAll: (cardId: string) => Promise<void>
  createCardsFromPresets: (projectId: string, pageId: string, items: Array<{ title: string; content: Record<string, unknown>; name?: string }>, afterCardId?: string) => Promise<void>
}

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  cardGroups: [],
  selectedCardIds: [],
  searchQuery: '',
  isLoading: false,

  loadCards: async (projectId: string) => {
    const cards = await db.cards.where('projectId').equals(projectId).sortBy('order')
    set({ cards })
  },

  loadCardGroups: async (projectId: string) => {
    const cardGroups = await db.cardGroups.where('projectId').equals(projectId).sortBy('order')
    set({ cardGroups })
  },

  createCard: async (projectId: string, pageId: string) => {
    const { selectedCardIds } = get()
    const allCards = await db.cards.where('projectId').equals(projectId).toArray()
    const pageCards = allCards.filter(c => c.pageId === pageId).sort((a, b) => a.order - b.order)
    const selectedCard = selectedCardIds.length > 0 ? pageCards.find(c => c.id === selectedCardIds[0]) : undefined
    const insertOrder = selectedCard != null ? selectedCard.order + 1 : pageCards.length
    const now = Date.now()

    for (const c of allCards) {
      if (c.pageId === pageId && c.order >= insertOrder) {
        await db.cards.update(c.id, { order: c.order + 1, updatedAt: now })
      }
    }

    // 获取页面信息以计算安全区域
    const page = await db.pages.get(pageId)
    const safeWidth = page ? getSafeArea(page).width : Number.MAX_VALUE

    const title = `卡片 ${insertOrder + 1}`
    const content = { type: 'doc', content: [] } as Record<string, unknown>
    const computed = calcCardSize(title, content, undefined, undefined, undefined, defaultCardStyle.titlePaddingY, defaultCardStyle.paddingX)
    const limitedWidth = Math.min(computed.width, safeWidth)
    const card: Card = {
      id: uuid(),
      projectId,
      pageId,
      title,
      content,
      style: { ...defaultCardStyle },
      size: { defaultWidth: limitedWidth, defaultHeight: computed.height, projectWidth: limitedWidth, projectHeight: computed.height },
      flags: { ...defaultCardFlags },
      position: { x: 0, y: 0 },
      order: insertOrder,
      createdAt: now,
      updatedAt: now,
    }
    await db.cards.add(card)

    const updatedPageCards = await db.cards.where('projectId').equals(projectId).and(c => c.pageId === pageId).sortBy('order')
    for (let i = 0; i < updatedPageCards.length; i++) {
      const c = updatedPageCards[i]
      if (c.order !== i) {
        await db.cards.update(c.id, { order: i, updatedAt: now })
      }
    }

    await get().loadCards(projectId)
    return card
  },

  updateCard: async (id: string, updates: Partial<Card>) => {
    await db.cards.update(id, { ...updates, updatedAt: Date.now() })
    const card = await db.cards.get(id)
    if (card) {
      const { cards } = get()
      const newCards = cards.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)
      set({ cards: newCards })
    }
  },

  deleteCard: async (id: string) => {
    await db.cards.delete(id)
    const { cards, selectedCardIds } = get()
    set({
      cards: cards.filter(c => c.id !== id),
      selectedCardIds: selectedCardIds.filter(sid => sid !== id),
    })
  },

  deleteCards: async (ids: string[]) => {
    await db.cards.bulkDelete(ids)
    const { cards, selectedCardIds } = get()
    set({
      cards: cards.filter(c => !ids.includes(c.id)),
      selectedCardIds: selectedCardIds.filter(sid => !ids.includes(sid)),
    })
  },

  duplicateCard: async (id: string, toPageId?: string) => {
    const card = await db.cards.get(id)
    if (!card) return
    const now = Date.now()
    const newCard: Card = {
      ...card,
      id: uuid(),
      pageId: toPageId || card.pageId,
      title: `${card.title} (副本)`,
      createdAt: now,
      updatedAt: now,
    }
    await db.cards.add(newCard)
    await get().loadCards(card.projectId)
  },

  reorderCards: async (cardIds: string[]) => {
    for (let i = 0; i < cardIds.length; i++) {
      await db.cards.update(cardIds[i], { order: i, updatedAt: Date.now() })
    }
    const { cards } = get()
    const projectId = cards[0]?.projectId
    if (projectId) await get().loadCards(projectId)
  },

  renumberCard: async (cardId: string, newNumber: number) => {
    const { cards } = get()
    const targetCard = cards.find(c => c.id === cardId)
    if (!targetCard || newNumber < 1) return

    const pages = await db.pages.where('projectId').equals(targetCard.projectId).sortBy('order')

    const globalOrdered: { cardId: string; pageId: string }[] = []
    for (const page of pages) {
      const pageCards = cards.filter(c => c.pageId === page.id).sort((a, b) => a.order - b.order)
      for (const c of pageCards) {
        globalOrdered.push({ cardId: c.id, pageId: c.pageId })
      }
    }

    const movedIdx = globalOrdered.findIndex(g => g.cardId === cardId)
    if (movedIdx < 0) return

    globalOrdered.splice(movedIdx, 1)

    let numCount = 0
    let insertAt = globalOrdered.length
    for (let i = 0; i < globalOrdered.length; i++) {
      const c = cards.find(cc => cc.id === globalOrdered[i].cardId)
      if (c && !c.flags.excludeFromNumbering) {
        numCount++
        if (numCount === newNumber) {
          insertAt = i
          break
        }
      }
    }

    let newPageId = targetCard.pageId
    if (insertAt < globalOrdered.length) {
      newPageId = globalOrdered[insertAt].pageId
    } else if (globalOrdered.length > 0) {
      newPageId = globalOrdered[globalOrdered.length - 1].pageId
    }

    globalOrdered.splice(insertAt, 0, { cardId, pageId: newPageId })

    const pageCardMap = new Map<string, string[]>()
    for (const g of globalOrdered) {
      const pgId = g.cardId === cardId ? newPageId : g.pageId
      if (!pageCardMap.has(pgId)) pageCardMap.set(pgId, [])
      pageCardMap.get(pgId)!.push(g.cardId)
    }

    const now = Date.now()
    for (const [pgId, cardList] of pageCardMap) {
      for (let i = 0; i < cardList.length; i++) {
        const cid = cardList[i]
        if (cid === cardId) {
          await db.cards.update(cid, { pageId: pgId, order: i, updatedAt: now })
        } else {
          await db.cards.update(cid, { order: i, updatedAt: now })
        }
      }
    }
    await get().loadCards(targetCard.projectId)
  },

  toggleCardSelection: (id: string) => {
    const { selectedCardIds } = get()
    if (selectedCardIds.includes(id)) {
      set({ selectedCardIds: selectedCardIds.filter(sid => sid !== id) })
    } else {
      set({ selectedCardIds: [...selectedCardIds, id] })
    }
  },

  selectAllCards: () => {
    const { cards, searchQuery } = get()
    const filtered = searchQuery
      ? cards.filter(c => c.title.includes(searchQuery) || JSON.stringify(c.content).includes(searchQuery))
      : cards
    set({ selectedCardIds: filtered.map(c => c.id) })
  },

  clearSelection: () => {
    set({ selectedCardIds: [] })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  createCardGroup: async (projectId: string, name: string) => {
    const groups = await db.cardGroups.where('projectId').equals(projectId).toArray()
    const group: CardGroup = {
      id: uuid(),
      projectId,
      name,
      color: '#cccccc',
      order: groups.length,
    }
    await db.cardGroups.add(group)
    await get().loadCardGroups(projectId)
  },

  deleteCardGroup: async (id: string) => {
    await db.cardGroups.delete(id)
    const { cardGroups } = get()
    const projectId = cardGroups[0]?.projectId
    if (projectId) await get().loadCardGroups(projectId)
  },

  renameCardGroup: async (id: string, name: string) => {
    await db.cardGroups.update(id, { name })
    const { cardGroups } = get()
    const projectId = cardGroups[0]?.projectId
    if (projectId) await get().loadCardGroups(projectId)
  },

  setCardGroup: async (cardId: string, groupId: string) => {
    await db.cards.update(cardId, { groupId, updatedAt: Date.now() })
    const { cards } = get()
    set({ cards: cards.map(c => c.id === cardId ? { ...c, groupId } : c) })
  },

  copyCardStyle: (cardId: string): CardStyle | null => {
    const { cards } = get()
    const card = cards.find(c => c.id === cardId)
    if (!card) return null
    sessionStorage.setItem('copiedCardStyle', JSON.stringify(card.style))
    return card.style
  },

  pasteCardStyle: async (cardId: string) => {
    const styleStr = sessionStorage.getItem('copiedCardStyle')
    if (!styleStr) return
    const style = JSON.parse(styleStr) as CardStyle
    await get().updateCard(cardId, { style })
  },

  applyStyleToAll: async (_cardId: string) => {
    const { cards } = get()
    const sourceCard = cards.find(c => c.id === _cardId)
    if (!sourceCard) return
    const style = sourceCard.style
    const projectCards = await db.cards.where('projectId').equals(sourceCard.projectId).toArray()
    for (const card of projectCards) {
      if (card.id === _cardId) continue
      await db.cards.update(card.id, { style, updatedAt: Date.now() })
    }
    const { projectId } = sourceCard
    const updatedCards = await db.cards.where('projectId').equals(projectId).toArray()
    set({ cards: updatedCards })
  },

  createCardsFromPresets: async (projectId: string, pageId: string, items: Array<{ title: string; content: Record<string, unknown>; name?: string }>, afterCardId?: string) => {
    const allCards = await db.cards.where('projectId').equals(projectId).toArray()
    let insertOrder: number

    if (afterCardId) {
      const target = allCards.find(c => c.id === afterCardId)
      insertOrder = target ? target.order + 1 : allCards.length
    } else {
      insertOrder = allCards.length
    }

    const shiftAmount = items.length
    for (const card of allCards) {
      if (card.order >= insertOrder) {
        await db.cards.update(card.id, { order: card.order + shiftAmount, updatedAt: Date.now() })
      }
    }

    // 获取页面信息以计算安全区域
    const page = await db.pages.get(pageId)
    const safeWidth = page ? getSafeArea(page).width : Number.MAX_VALUE

    const now = Date.now()
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const computed = calcCardSize(item.title, item.content, undefined, undefined, undefined, defaultCardStyle.titlePaddingY, defaultCardStyle.paddingX)
      const limitedWidth = Math.min(computed.width, safeWidth)
      const card: Card = {
        id: uuid(),
        projectId,
        pageId,
        title: item.title,
        name: item.name,
        content: item.content,
        style: { ...defaultCardStyle },
        size: { defaultWidth: limitedWidth, defaultHeight: computed.height, projectWidth: limitedWidth, projectHeight: computed.height },
        flags: { ...defaultCardFlags },
        position: { x: 0, y: 0 },
        order: insertOrder + i,
        createdAt: now + i,
        updatedAt: now + i,
      }
      await db.cards.add(card)
    }

    await get().loadCards(projectId)
  },
}))
