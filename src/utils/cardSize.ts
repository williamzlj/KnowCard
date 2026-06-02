const FONT_SIZE_PX = 13
const LINE_HEIGHT_RATIO = 1.5
const PADDING_X_PX = 10
const PADDING_Y_PX = 3
const MIN_WIDTH_MM = 40
const MIN_HEIGHT_MM = 22
const MAX_WIDTH_MM = 300
export const PX_PER_MM = 3.779527559

let measureCanvas: HTMLCanvasElement | null = null

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
  }
  return measureCanvas.getContext('2d')
}

export function measureTextWidth(text: string, fontSize: number, fontFamily: string, bold = false, italic = false): number {
  const ctx = getMeasureContext()
  if (!ctx) return estimateTextWidth(text, fontSize)
  const parts: string[] = []
  if (italic) parts.push('italic')
  if (bold) parts.push('bold')
  parts.push(`${fontSize}px`)
  parts.push(fontFamily)
  ctx.font = parts.join(' ')
  return ctx.measureText(text).width
}

function calcTitleHeight(titleFontSize: number): number {
  return titleFontSize * 2 + 4
}

export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) {
      width += fontSize
    } else {
      width += fontSize * 0.6
    }
  }
  return width
}

export function splitTextToLines(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = []
  let currentLine = ''
  let currentWidth = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const charWidth = ((char.charCodeAt(0) >= 0x4e00 && char.charCodeAt(0) <= 0x9fff) || 
                     (char.charCodeAt(0) >= 0x3000 && char.charCodeAt(0) <= 0x303f) || 
                     (char.charCodeAt(0) >= 0xff00 && char.charCodeAt(0) <= 0xffef)) ? fontSize : fontSize * 0.6

    if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = char
      currentWidth = charWidth
    } else {
      currentLine += char
      currentWidth += charWidth
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  return lines
}

export function calcCardSize(title: string, content: Record<string, unknown>, fontSize: number = FONT_SIZE_PX, titleFontSize: number = fontSize + 1, lineHeightRatio: number = LINE_HEIGHT_RATIO, titlePaddingY: number = 4, paddingX: number = 10, hideBodyArea: boolean = false, titleHeightMm?: number): { width: number; height: number } {
  const titleWidth = title ? estimateTextWidth(title, titleFontSize) : 0
  const bodyText = extractText(content)
  const lines = bodyText ? bodyText.split('\n') : ['']
  const lineHeight = fontSize * lineHeightRatio

  let maxLineWidth = 0
  for (const line of lines) {
    const lineW = estimateTextWidth(line, fontSize)
    if (lineW > maxLineWidth) maxLineWidth = lineW
  }

  const hasTitle = title.trim() !== ''
  const contentWidthPx = Math.max(titleWidth, maxLineWidth)
  const totalWidthPx = contentWidthPx + paddingX * 2
  
  // 计算标题行数，最多2行
  let titleLinesCount = 1
  if (hasTitle && title) {
    const titleLines = splitTextToLines(title, titleFontSize, contentWidthPx)
    titleLinesCount = Math.min(2, titleLines.length)
  }

  const titleGapExtra = hasTitle && !hideBodyArea ? 6 : 0
  const bodyHeightPx = hideBodyArea ? 0 : lines.length * lineHeight
  const autoTitleHeight = hasTitle ? titleFontSize * 1.2 * titleLinesCount + titlePaddingY * 2 : 0
  const titleHeight = titleHeightMm != null ? titleHeightMm * PX_PER_MM : autoTitleHeight
  const totalHeightPx = titleHeight + bodyHeightPx + PADDING_Y_PX * 2 + titleGapExtra

  const widthMm = Math.max(MIN_WIDTH_MM, Math.min(MAX_WIDTH_MM, totalWidthPx / PX_PER_MM))
  const heightMm = hideBodyArea ? totalHeightPx / PX_PER_MM : Math.max(MIN_HEIGHT_MM, totalHeightPx / PX_PER_MM)

  return {
    width: Math.round(widthMm),
    height: Math.ceil(heightMm) + 1,
  }
}

export function calcCardHeight(title: string, content: Record<string, unknown>, givenWidthMm: number, fontSize: number = FONT_SIZE_PX, titleFontSize: number = fontSize + 1, lineHeightRatio: number = LINE_HEIGHT_RATIO, paddingX: number = 10, titlePaddingY: number = 4, showNumber: boolean = false, cardNumber: number = 0, hideBodyArea: boolean = false, titleHeightMm?: number): number {
  const hasTitle = title.trim() !== ''
  const cardWidthPx = givenWidthMm * PX_PER_MM
  const bodyWidthPx = cardWidthPx - paddingX * 2
  const lineHeight = fontSize * lineHeightRatio

  const bodyText = extractText(content)
  const lines = bodyText ? bodyText.split('\n') : ['']

  let totalVisualLines = 0
  for (const line of lines) {
    if (line.length === 0) {
      totalVisualLines += 1
      continue
    }
    let remaining = line
    while (remaining.length > 0) {
      let i = 1
      while (i <= remaining.length && estimateTextWidth(remaining.slice(0, i), fontSize) <= bodyWidthPx) {
        i++
      }
      i--
      if (i <= 0) i = 1
      remaining = remaining.slice(i)
      totalVisualLines += 1
    }
  }
  if (totalVisualLines === 0) totalVisualLines = 1

  // 计算标题行数，最多2行
  let titleLinesCount = 1
  if (hasTitle && title) {
    // 计算编号占用的宽度
    const numberText = showNumber ? `${cardNumber}.` : ''
    const numberWidth = showNumber ? estimateTextWidth(numberText, titleFontSize) + 1 : 0 // +1 是编号和标题之间的间隔
    const titleWidthPx = bodyWidthPx - numberWidth
    const titleLines = splitTextToLines(title, titleFontSize, titleWidthPx)
    titleLinesCount = Math.min(2, titleLines.length)
  }

  const bodyHeightPx = hideBodyArea ? 0 : totalVisualLines * lineHeight
  const titleGapExtra = hasTitle && !hideBodyArea ? 6 : 0
  const autoTitleHeight = hasTitle ? titleFontSize * 1.2 * titleLinesCount + titlePaddingY * 2 : 0
  const titleHeight = titleHeightMm != null ? titleHeightMm * PX_PER_MM : autoTitleHeight
  const totalHeightPx = titleHeight + bodyHeightPx + PADDING_Y_PX * 2 + titleGapExtra
  const heightMm = hideBodyArea ? totalHeightPx / PX_PER_MM : Math.max(MIN_HEIGHT_MM, totalHeightPx / PX_PER_MM)

  return Math.ceil(heightMm) + 1
}

function extractText(content: Record<string, unknown>): string {
  if (!content || !content.content) return ''
  const walk = (node: Record<string, unknown>): string => {
    if (node.type === 'text') return (node.text as string) || ''
    if ((node as Record<string, unknown>).content && Array.isArray((node as Record<string, unknown>).content)) {
      return ((node as Record<string, unknown>).content as Array<Record<string, unknown>>).map(walk).join(' ')
    }
    return ''
  }
  if (Array.isArray(content.content)) {
    return (content.content as Array<Record<string, unknown>>).map(walk).join('\n')
  }
  return ''
}
