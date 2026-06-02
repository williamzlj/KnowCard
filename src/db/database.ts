import Dexie, { type Table } from 'dexie'
import type { Card, CardGroup } from '../types/card'
import type { Page } from '../types/page'
import type { Project } from '../types/project'
import type { PageElement } from '../types/element'

export interface AppSettings {
  key: string
  value: unknown
}

export interface CardStylePreset {
  id: string
  name: string
  style: string
  createdAt: number
  pinned?: boolean
}

export interface CardContentPreset {
  id: string
  name: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

export interface CardSizePreset {
  id: string
  name: string
  width: number
  height: number
  createdAt: number
  pinned?: boolean
}

export interface User {
  id: string
  username: string
  passwordHash: string
  isAdmin: boolean
  createdAt: number
  updatedAt: number
}

export interface ImageLibraryItem {
  id: string
  name: string
  keywords: string
  dataUrl: string
  createdAt: number
}

export interface RegexPreset {
  id: string
  name: string
  description: string
  pattern: string
  replace: string
  createdAt: number
}

export class KnowCardDB extends Dexie {
  projects!: Table<Project, string>
  pages!: Table<Page, string>
  cards!: Table<Card, string>
  cardGroups!: Table<CardGroup, string>
  pageElements!: Table<PageElement, string>
  settings!: Table<AppSettings, string>
  stylePresets!: Table<CardStylePreset, string>
  contentPresets!: Table<CardContentPreset, string>
  cardSizePresets!: Table<CardSizePreset, string>
  users!: Table<User, string>
  imageLibrary!: Table<ImageLibraryItem, string>
  regexPresets!: Table<RegexPreset, string>

  constructor() {
    super('KnowCardDB')

    this.version(1).stores({
      projects: 'id, createdAt',
      pages: 'id, projectId, order',
      cards: 'id, projectId, pageId, groupId, order',
      cardGroups: 'id, projectId, order',
      pageElements: 'id, pageId, zIndex',
      settings: 'key',
    })

    this.version(2).stores({
      projects: 'id, createdAt',
      pages: 'id, projectId, order',
      cards: 'id, projectId, pageId, groupId, order',
      cardGroups: 'id, projectId, order',
      pageElements: 'id, pageId, zIndex',
      settings: 'key',
      stylePresets: 'id, createdAt',
      contentPresets: 'id, createdAt',
    })

    this.version(3).stores({
      projects: 'id, createdAt',
      pages: 'id, projectId, order',
      cards: 'id, projectId, pageId, groupId, order',
      cardGroups: 'id, projectId, order',
      pageElements: 'id, pageId, zIndex',
      settings: 'key',
      stylePresets: 'id, createdAt',
      contentPresets: 'id, createdAt',
      cardSizePresets: 'id, createdAt',
    })

    this.version(4).stores({
      projects: 'id, createdAt',
      pages: 'id, projectId, order',
      cards: 'id, projectId, pageId, groupId, order',
      cardGroups: 'id, projectId, order',
      pageElements: 'id, pageId, zIndex',
      settings: 'key',
      stylePresets: 'id, createdAt',
      contentPresets: 'id, createdAt',
      cardSizePresets: 'id, createdAt',
      users: 'id, username, isAdmin',
    })

    this.version(5).stores({
      projects: 'id, createdAt',
      pages: 'id, projectId, order',
      cards: 'id, projectId, pageId, groupId, order',
      cardGroups: 'id, projectId, order',
      pageElements: 'id, pageId, zIndex',
      settings: 'key',
      stylePresets: 'id, createdAt',
      contentPresets: 'id, createdAt',
      cardSizePresets: 'id, createdAt',
      users: 'id, username, isAdmin',
      imageLibrary: 'id, name, keywords',
    })

    this.version(6).stores({
      projects: 'id, createdAt',
      pages: 'id, projectId, order',
      cards: 'id, projectId, pageId, groupId, order',
      cardGroups: 'id, projectId, order',
      pageElements: 'id, pageId, zIndex',
      settings: 'key',
      stylePresets: 'id, createdAt',
      contentPresets: 'id, createdAt',
      cardSizePresets: 'id, createdAt',
      users: 'id, username, isAdmin',
      imageLibrary: 'id, name, keywords',
      regexPresets: 'id, createdAt',
    })

    this.version(7).stores({
      projects: 'id, createdAt',
      pages: 'id, projectId, order',
      cards: 'id, projectId, pageId, groupId, order',
      cardGroups: 'id, projectId, order',
      pageElements: 'id, pageId, zIndex',
      settings: 'key',
      stylePresets: 'id, createdAt',
      contentPresets: 'id, createdAt',
      cardSizePresets: 'id, createdAt',
      users: 'id, username, isAdmin',
      imageLibrary: 'id, name, keywords, createdAt',
      regexPresets: 'id, createdAt',
    })
  }
}

export const db = new KnowCardDB()
