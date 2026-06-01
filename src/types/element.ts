export type PageElementType = 'text' | 'image' | 'line' | 'arrow' | 'red-box'

export interface PageElement {
  id: string
  pageId: string
  type: PageElementType

  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number

  style: Record<string, unknown>
  content: Record<string, unknown>

  zIndex: number
  createdAt: number
  updatedAt: number
}
