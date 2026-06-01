const FONT_SIZE_PX = 13
const LINE_HEIGHT_RATIO = 1.5
const PADDING_X_PX = 10
const PADDING_Y_PX = 3
const MIN_WIDTH_MM = 40
const MIN_HEIGHT_MM = 22
const MAX_WIDTH_MM = 300
export const PX_PER_MM = 3.779527559

function calcTitleHeight(titleFontSize: number): number {
  return titleFontSize * 2 + 4
}

function estimateTextWidth(text: string, fontSize: number): number {
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

export function calcCardSize(title: string, content: Record<string, unknown>, fontSize: number = FONT_SIZE_PX, titleFontSize: number = fontSize + 1): { width: number; height: number } {
  const titleWidth = title ? estimateTextWidth(title, titleFontSize) : 0
  const bodyText = extractText(content)
  const lines = bodyText ? bodyText.split('\n') : ['']
  const lineHeight = fontSize * LINE_HEIGHT_RATIO

  let maxLineWidth = 0
  for (const line of lines) {
    const lineW = estimateTextWidth(line, fontSize)
    if (lineW > maxLineWidth) maxLineWidth = lineW
  }

  const hasTitle = title.trim() !== ''
  const contentWidthPx = Math.max(titleWidth, maxLineWidth)
  const totalWidthPx = contentWidthPx + PADDING_X_PX * 2

  const titleGapExtra = hasTitle ? 6 : 0
  const bodyHeightPx = lines.length * lineHeight
  const totalHeightPx = (hasTitle ? calcTitleHeight(titleFontSize) : 0) + bodyHeightPx + PADDING_Y_PX * 2 + titleGapExtra

  const widthMm = Math.max(MIN_WIDTH_MM, Math.min(MAX_WIDTH_MM, totalWidthPx / PX_PER_MM))
  const heightMm = Math.max(MIN_HEIGHT_MM, totalHeightPx / PX_PER_MM)

  return {
    width: Math.round(widthMm),
    height: Math.ceil(heightMm),
  }
}

export function calcCardHeight(title: string, content: Record<string, unknown>, givenWidthMm: number, fontSize: number = FONT_SIZE_PX, titleFontSize: number = fontSize + 1): number {
  const hasTitle = title.trim() !== ''
  const cardWidthPx = givenWidthMm * PX_PER_MM
  const bodyWidthPx = cardWidthPx - PADDING_X_PX * 2
  const lineHeight = fontSize * LINE_HEIGHT_RATIO

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

  const bodyHeightPx = totalVisualLines * lineHeight
  const titleGapExtra = hasTitle ? 6 : 0
  const totalHeightPx = (hasTitle ? calcTitleHeight(titleFontSize) : 0) + bodyHeightPx + PADDING_Y_PX * 2 + titleGapExtra
  const heightMm = Math.max(MIN_HEIGHT_MM, totalHeightPx / PX_PER_MM)

  return Math.ceil(heightMm)
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
