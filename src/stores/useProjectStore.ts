import { create } from 'zustand'
import type { Project } from '../types/project'
import { db } from '../db/database'
import { v4 as uuid } from 'uuid'

interface ProjectStore {
  projects: Project[]
  currentProjectId: string | null
  isLoading: boolean

  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<Project>
  renameProject: (id: string, name: string) => Promise<void>
  duplicateProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setCurrentProject: (id: string) => void
  exportProject: (id: string) => Promise<Blob>
  importProject: (blob: Blob) => Promise<void>
  reorderProjects: (newOrder: Project[]) => Promise<void>
  togglePin: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoading: false,

  loadProjects: async () => {
    let projects = await db.projects.orderBy('createdAt').toArray()
    projects = projects.map((p, index) => ({
      ...p,
      order: p.order ?? index,
      isPinned: p.isPinned ?? false,
    }))
    projects.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1
      }
      return a.order - b.order
    })
    set({ projects })
  },

  createProject: async (name: string) => {
    const now = Date.now()
    const { projects } = get()
    const maxOrder = projects.length > 0 ? Math.max(...projects.map(p => p.order)) + 1 : 0
    const project: Project = {
      id: uuid(),
      name,
      description: '',
      createdAt: now,
      updatedAt: now,
      order: maxOrder,
      isPinned: false,
    }
    await db.projects.add(project)
    await get().loadProjects()
    set({ currentProjectId: project.id })
    return project
  },

  renameProject: async (id: string, name: string) => {
    await db.projects.update(id, { name, updatedAt: Date.now() })
    await get().loadProjects()
  },

  duplicateProject: async (id: string) => {
    const project = await db.projects.get(id)
    if (!project) return
    const newId = uuid()
    const now = Date.now()
    const newProject: Project = {
      ...project,
      id: newId,
      name: `${project.name} (副本)`,
      createdAt: now,
      updatedAt: now,
    }
    await db.projects.add(newProject)

    const pageIdMap = new Map<string, string>()
    const pages = await db.pages.where('projectId').equals(id).toArray()
    for (const page of pages) {
      const newPageId = uuid()
      pageIdMap.set(page.id, newPageId)
      await db.pages.add({ ...page, id: newPageId, projectId: newId, createdAt: now, updatedAt: now })
    }

    const groupIdMap = new Map<string, string>()
    const groups = await db.cardGroups.where('projectId').equals(id).toArray()
    for (const group of groups) {
      const newGroupId = uuid()
      groupIdMap.set(group.id, newGroupId)
      await db.cardGroups.add({ ...group, id: newGroupId, projectId: newId })
    }

    const cards = await db.cards.where('projectId').equals(id).toArray()
    for (const card of cards) {
      const newPageId = pageIdMap.get(card.pageId) || card.pageId
      const newGroupId = card.groupId ? (groupIdMap.get(card.groupId) || card.groupId) : undefined
      await db.cards.add({ ...card, id: uuid(), projectId: newId, pageId: newPageId, groupId: newGroupId, createdAt: now, updatedAt: now })
    }

    const elements = await db.pageElements.where('pageId').anyOf([...pageIdMap.keys()]).toArray()
    for (const el of elements) {
      const newPageId = pageIdMap.get(el.pageId) || el.pageId
      await db.pageElements.add({ ...el, id: uuid(), pageId: newPageId, createdAt: now, updatedAt: now })
    }

    await get().loadProjects()
  },

  deleteProject: async (id: string) => {
    const pages = await db.pages.where('projectId').equals(id).toArray()
    const pageIds = pages.map(p => p.id)
    await db.projects.delete(id)
    await db.pages.where('projectId').equals(id).delete()
    await db.cards.where('projectId').equals(id).delete()
    await db.cardGroups.where('projectId').equals(id).delete()
    if (pageIds.length > 0) {
      await db.pageElements.where('pageId').anyOf(pageIds).delete()
    }
    const { currentProjectId } = get()
    if (currentProjectId === id) {
      set({ currentProjectId: null })
    }
    await get().loadProjects()
  },

  setCurrentProject: (id: string) => {
    set({ currentProjectId: id })
  },

  exportProject: async (id: string) => {
    const project = await db.projects.get(id)
    const pages = await db.pages.where('projectId').equals(id).toArray()
    const cards = await db.cards.where('projectId').equals(id).toArray()
    const groups = await db.cardGroups.where('projectId').equals(id).toArray()
    const pageIds = pages.map(p => p.id)
    const elements = pageIds.length > 0 ? await db.pageElements.where('pageId').anyOf(pageIds).toArray() : []

    const data = { project, pages, cards, groups, elements, version: 2 }
    return new Blob([JSON.stringify(data)], { type: 'application/json' })
  },

  importProject: async (blob: Blob) => {
    const text = await blob.text()
    const data = JSON.parse(text)

    if (data.version !== 1 && data.version !== 2) throw new Error('不支持的导入格式')

    const now = Date.now()
    const newProjectId = uuid()
    const { projects } = get()
    const maxOrder = projects.length > 0 ? Math.max(...projects.map(p => p.order)) + 1 : 0

    await db.projects.add({ ...data.project, id: newProjectId, createdAt: now, updatedAt: now, order: maxOrder, isPinned: false })

    const pageIdMap = new Map<string, string>()
    for (const page of data.pages || []) {
      const newPageId = uuid()
      pageIdMap.set(page.id, newPageId)
      await db.pages.add({ ...page, id: newPageId, projectId: newProjectId, createdAt: now, updatedAt: now })
    }

    const groupIdMap = new Map<string, string>()
    for (const group of data.groups || []) {
      const newGroupId = uuid()
      groupIdMap.set(group.id, newGroupId)
      await db.cardGroups.add({ ...group, id: newGroupId, projectId: newProjectId })
    }

    for (const card of data.cards || []) {
      const newPageId = pageIdMap.get(card.pageId) || card.pageId
      const newGroupId = card.groupId ? (groupIdMap.get(card.groupId) || card.groupId) : undefined
      await db.cards.add({ ...card, id: uuid(), projectId: newProjectId, pageId: newPageId, groupId: newGroupId, createdAt: now, updatedAt: now })
    }

    for (const el of data.elements || []) {
      const newPageId = pageIdMap.get(el.pageId) || el.pageId
      await db.pageElements.add({ ...el, id: uuid(), pageId: newPageId, createdAt: now, updatedAt: now })
    }

    await get().loadProjects()
    set({ currentProjectId: newProjectId })
  },

  reorderProjects: async (newOrder: Project[]) => {
    for (let i = 0; i < newOrder.length; i++) {
      await db.projects.update(newOrder[i].id, { order: i, updatedAt: Date.now() })
    }
    await get().loadProjects()
  },

  togglePin: async (id: string) => {
    const project = await db.projects.get(id)
    if (project) {
      await db.projects.update(id, { isPinned: !project.isPinned, updatedAt: Date.now() })
      await get().loadProjects()
    }
  },
}))
