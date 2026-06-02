export interface CardStyle {
  titleFont: string
  titleFontSize: number
  titleBold: boolean
  titleColor: string
  titleBackgroundColor: string
  titlePaddingY: number
  titleHeight?: number

  bodyFont: string
  bodyFontSize: number
  bodyColor: string
  bodyBackgroundColor: string
  bodyLineHeight: number

  paddingX: number

  borderColor: string
  borderWidth: number
  borderRadius: number
}

export interface CardSize {
  defaultWidth: number
  defaultHeight: number
  projectWidth: number
  projectHeight: number
}

export interface CardFlags {
  hideBorder: boolean
  hideTitle: boolean
  hideBody: boolean
  hideBodyArea: boolean
  showNumber: boolean
  excludeFromLayout: boolean
  excludeFromNumbering: boolean
}

export interface Card {
  id: string
  projectId: string
  pageId: string
  title: string
  name?: string
  content: Record<string, unknown>

  style: CardStyle
  size: CardSize
  flags: CardFlags

  position: {
    x: number
    y: number
  }

  groupId?: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface CardGroup {
  id: string
  projectId: string
  name: string
  color: string
  order: number
}

export const ALLOWED_FONTS = [
  '宋体',
  '黑体',
  '楷体',
  'Arial',
  'Times New Roman',
  'Georgia',
]
