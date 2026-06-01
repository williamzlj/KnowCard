export type PageSize = 'A4' | 'A3'
export type PageOrientation = 'portrait' | 'landscape'

export interface PageMargins {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PageNumberSettings {
  enabled: boolean
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  font: string
  color: string
  size: number
}

export interface FooterSettings {
  enabled: boolean
  text: string
  font: string
  color: string
  size: number
  position: 'left' | 'center' | 'right'
}

export interface WatermarkSettings {
  enabled: boolean
  text: string
  fontSize: number
  opacity: number
  density: number
  spacing: number
  color: string
}

export interface Page {
  id: string
  projectId: string
  name: string
  size: PageSize
  orientation: PageOrientation
  margins: PageMargins
  pageNumber: PageNumberSettings
  footer: FooterSettings
  watermark: WatermarkSettings
  cardMinHSpacing: number
  cardMinVSpacing: number
  order: number
  backgroundColor: string
  createdAt: number
  updatedAt: number
}

export function getPageDimensions(page: Page): { width: number; height: number } {
  const base: Record<PageSize, { width: number; height: number }> = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
  }

  const dims = base[page.size]
  if (page.orientation === 'landscape') {
    return { width: dims.height, height: dims.width }
  }
  return dims
}

export function getSafeArea(page: Page): {
  x: number
  y: number
  width: number
  height: number
} {
  const dims = getPageDimensions(page)
  return {
    x: page.margins.left,
    y: page.margins.top,
    width: dims.width - page.margins.left - page.margins.right,
    height: dims.height - page.margins.top - page.margins.bottom,
  }
}
