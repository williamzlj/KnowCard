export interface TextSegment {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  color: string
  fontSize: number
  align: string
  imageSrc?: string
  imageWidth?: string
  imageHeight?: string
  latex?: string
}

export interface ParsedLine {
  segments: TextSegment[]
}

type TipTapMark = { type: string; attrs?: Record<string, unknown> }
type TipTapNode = { type: string; text?: string; marks?: TipTapMark[]; content?: TipTapNode[]; attrs?: Record<string, unknown> }

function flattenInline(node: TipTapNode, defaults: { color: string; fontSize: number; bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean; align: string }): TextSegment[] {
  if (node.type === 'inlineMath') {
    const latex = (node.attrs?.latex as string) || (node.text as string) || ''
    if (!latex) return []
    return [{ text: '', bold: false, italic: false, underline: false, strikethrough: false, color: defaults.color, fontSize: defaults.fontSize, align: defaults.align, latex }]
  }
  if (node.type === 'image') {
    const src = (node.attrs?.src as string) || ''
    if (!src) return []
    return [{ text: '', bold: false, italic: false, underline: false, strikethrough: false, color: defaults.color, fontSize: defaults.fontSize, align: defaults.align, imageSrc: src, imageWidth: node.attrs?.width as string, imageHeight: node.attrs?.height as string }]
  }
  if (node.type === 'text') {
    let text = node.text || ''
    if (!text) return []
    let color = defaults.color
    let fontSize = defaults.fontSize
    let bold = defaults.bold
    let italic = defaults.italic
    let underline = defaults.underline
    let strikethrough = defaults.strikethrough

    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') bold = true
        if (mark.type === 'italic') italic = true
        if (mark.type === 'underline') underline = true
        if (mark.type === 'strike') strikethrough = true
        if (mark.type === 'textStyle' && mark.attrs) {
          if (mark.attrs.color) color = mark.attrs.color as string
          if (mark.attrs.fontSize) fontSize = mark.attrs.fontSize as number
        }
      }
    }

    const style = { bold, italic, underline, strikethrough, color, fontSize }
    const seg = (t: string): TextSegment => ({ text: t, ...style, align: defaults.align })
    const mathSeg = (latex: string): TextSegment => ({ text: '', bold: false, italic: false, underline: false, strikethrough: false, color: defaults.color, fontSize: defaults.fontSize, align: defaults.align, latex })

    const parts: TextSegment[] = []
    let lastIdx = 0
    const formulaRegex = /(?<!\$)\$\$([^\n$]+?)\$\$(?!\$)|(?<!\$)\$([^\n$]+?)\$(?!\$)/g
    let match
    while ((match = formulaRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(seg(text.slice(lastIdx, match.index)))
      }
      const latexContent = match[1] || match[2]
      parts.push(mathSeg(latexContent))
      lastIdx = match.index + match[0].length
    }
    if (parts.length === 0) {
      return [seg(text)]
    }
    if (lastIdx < text.length) {
      parts.push(seg(text.slice(lastIdx)))
    }
    return parts
  }
  if (node.content && Array.isArray(node.content)) {
    return node.content.flatMap(child => flattenInline(child, defaults))
  }
  return []
}

function parseListNode(node: TipTapNode, defaults: { color: string; fontSize: number }, isOrdered: boolean, depth: number): ParsedLine[] {
  const lines: ParsedLine[] = []
  let itemIndex = 0
  for (const item of (node.content || []) as TipTapNode[]) {
    if (item.type !== 'listItem') continue
    const indent = '  '.repeat(depth)
    const prefix = isOrdered ? `${indent}${itemIndex + 1}. ` : `${indent}• `
    itemIndex++
    for (const child of (item.content || []) as TipTapNode[]) {
      if (child.type === 'bulletList') {
        lines.push(...parseListNode(child, defaults, false, depth + 1))
      } else if (child.type === 'orderedList') {
        lines.push(...parseListNode(child, defaults, true, depth + 1))
      } else if (child.type === 'paragraph' || child.type === 'heading') {
        const align = (child.attrs?.textAlign as string) || 'left'
        const segments = flattenInline(child, { ...defaults, bold: false, italic: false, underline: false, strikethrough: false, align })
        if (segments.length > 0) {
          segments[0].text = prefix + segments[0].text
          lines.push({ segments })
        } else {
          lines.push({ segments: [{ text: prefix, bold: false, italic: false, underline: false, strikethrough: false, color: defaults.color, fontSize: defaults.fontSize, align }] })
        }
      }
    }
  }
  return lines
}

export function parseRichText(content: Record<string, unknown>, bodyColor: string, bodyFontSize: number): ParsedLine[] {
  if (!content || !content.content || !Array.isArray(content.content)) return []

  const lines: ParsedLine[] = []
  for (const node of content.content as TipTapNode[]) {
    if (node.type === 'image') {
      const src = (node.attrs?.src as string) || ''
      if (src) {
        lines.push({
          segments: [{
            text: '', bold: false, italic: false, underline: false,
            strikethrough: false, color: bodyColor, fontSize: bodyFontSize,
            align: 'left', imageSrc: src, imageWidth: node.attrs?.width as string, imageHeight: node.attrs?.height as string,
          }],
        })
      }
    } else if (node.type === 'blockMath') {
      const latex = (node.attrs?.latex as string) || (node.text as string) || ''
      if (latex) {
        lines.push({
          segments: [{
            text: '', bold: false, italic: false, underline: false,
            strikethrough: false, color: bodyColor, fontSize: bodyFontSize,
            align: 'center', latex,
          }],
        })
      }
    } else if (node.type === 'paragraph' || node.type === 'heading') {
      const level = node.type === 'heading' ? ((node.attrs?.level as number) || 1) : 0
      const fontSize = level > 0 ? bodyFontSize + (4 - level) * 2 : bodyFontSize
      const bold = level > 0
      const align = (node.attrs?.textAlign as string) || 'left'
      const segments = flattenInline(node, {
        color: bodyColor,
        fontSize,
        bold,
        italic: false,
        underline: false,
        strikethrough: false,
        align,
      })
      if (segments.length > 0) {
        lines.push({ segments })
      } else {
        lines.push({ segments: [{ text: ' ', bold: false, italic: false, underline: false, strikethrough: false, color: bodyColor, fontSize, align }] })
      }
    } else if (node.type === 'bulletList') {
      lines.push(...parseListNode(node, { color: bodyColor, fontSize: bodyFontSize }, false, 0))
    } else if (node.type === 'orderedList') {
      lines.push(...parseListNode(node, { color: bodyColor, fontSize: bodyFontSize }, true, 0))
    }
  }
  return lines
}

export function extractPlainText(content: Record<string, unknown>): string {
  if (!content || !content.content || !Array.isArray(content.content)) return ''
  const walk = (node: TipTapNode): string => {
    if (node.type === 'text') return (node.text as string) || ''
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(walk).join('')
    }
    return ''
  }
  const parts: string[] = []
  for (const node of content.content as TipTapNode[]) {
    parts.push(walk(node))
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
