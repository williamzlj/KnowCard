import { create } from 'zustand'

interface CanvasStore {
  zoom: number
  offsetX: number
  offsetY: number
  minZoom: number
  maxZoom: number

  setZoom: (zoom: number) => void
  setOffset: (x: number, y: number) => void
  resetView: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomToFit: (viewportWidth: number, viewportHeight: number, contentWidth: number, contentHeight: number) => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  minZoom: 0.1,
  maxZoom: 5,

  setZoom: (zoom: number) => {
    const { minZoom, maxZoom } = useCanvasStore.getState()
    set({ zoom: Math.max(minZoom, Math.min(maxZoom, zoom)) })
  },

  setOffset: (x: number, y: number) => {
    set({ offsetX: x, offsetY: y })
  },

  resetView: () => {
    set({ zoom: 1, offsetX: 0, offsetY: 0 })
  },

  zoomIn: () => {
    const { zoom, maxZoom } = useCanvasStore.getState()
    const newZoom = Math.min(maxZoom, zoom * 1.2)
    set({ zoom: newZoom })
  },

  zoomOut: () => {
    const { zoom, minZoom } = useCanvasStore.getState()
    const newZoom = Math.max(minZoom, zoom / 1.2)
    set({ zoom: newZoom })
  },

  zoomToFit: (viewportWidth: number, viewportHeight: number, contentWidth: number, contentHeight: number) => {
    if (contentWidth === 0 || contentHeight === 0) return
    const scaleX = (viewportWidth - 40) / contentWidth
    const scaleY = (viewportHeight - 40) / contentHeight
    const zoom = Math.min(scaleX, scaleY)
    const offsetX = (viewportWidth - contentWidth * zoom) / 2
    const offsetY = (viewportHeight - contentHeight * zoom) / 2
    set({ zoom: Math.max(0.1, Math.min(5, zoom)), offsetX, offsetY })
  },
}))
