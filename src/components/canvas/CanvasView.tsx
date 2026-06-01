import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Stage, Layer, Rect, Text, Group, Line, Arrow, Circle, Image as KonvaImage, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useCardStore, usePageStore, useCanvasStore, useProjectStore } from '../../stores'
import { usePageElementStore } from '../../stores/usePageElementStore'
import { useEditorStore } from '../../stores/useEditorStore'
import { getPageDimensions, getSafeArea } from '../../types/page'
import type { Page } from '../../types/page'
import type { Card } from '../../types/card'
import type { PageElement } from '../../types/element'
import { parseRichText, type TextSegment } from '../../utils/richText'
import { applyCompactLayout, applyCompactLayoutVertical, findOverflowCards, findOverlapping, type Rect as CardRect } from '../../utils/cardLayout'
import katex from 'katex'
import html2canvas from 'html2canvas'
import { TextInputDialog, computeTextElementSize } from './TextInputDialog'

const MM_TO_PX = 3.779527559

const cardGroupRefsModule = new Map<string, Konva.Group>()
const dragStartPosModule = new Map<string, { x: number; y: number }>()

function CardRenderer({ card, cardNumber, isSelected, onSelect, onDragStart, onDragMove, onDragEnd, onDoubleClick, onTransformEnd }: {
  card: Card
  cardNumber: number
  isSelected: boolean
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: (id: string, x: number, y: number) => void
  onDragMove: (id: string, x: number, y: number) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onDoubleClick: (id: string) => void
  onTransformEnd: (id: string, w: number, h: number, x: number, y: number) => void
}) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeRef = useRef<Konva.Rect>(null)

  useEffect(() => {
    if (groupRef.current) {
      cardGroupRefsModule.set(card.id, groupRef.current)
      return () => { cardGroupRefsModule.delete(card.id) }
    }
  }, [card.id])

  const w = card.size.projectWidth * MM_TO_PX
  const h = card.size.projectHeight * MM_TO_PX
  const titleFontSize = card.style.titleFontSize ?? 14
  const bodyFontSize = card.style.bodyFontSize ?? 13
  const hasTitle = !card.flags.hideTitle && card.title.trim() !== ''
  const hasBorder = !card.flags.hideBorder
  const titleHeight = hasTitle ? titleFontSize * 2 + 4 : 0

  useEffect(() => {
    if (isSelected && trRef.current && resizeRef.current) {
      trRef.current.nodes([resizeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected, w, h])

  const handleResizeTransform = () => {
    if (resizeRef.current) {
      const node = resizeRef.current
      const sx = node.scaleX()
      const sy = node.scaleY()
      if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return
      const newW = Math.max(20, node.width() * sx)
      const newH = Math.max(20, node.height() * sy)
      node.scaleX(1)
      node.scaleY(1)
      node.width(newW)
      node.height(newH)
    }
  }

  const handleResizeEnd = () => {
    if (resizeRef.current) {
      const node = resizeRef.current
      onTransformEnd(card.id, node.width(), node.height(), node.x(), node.y())
    }
  }

  return (
    <>
      <Rect
        ref={resizeRef}
        x={card.position.x * MM_TO_PX}
        y={card.position.y * MM_TO_PX}
        width={w}
        height={h}
        fill="transparent"
        stroke="transparent"
        onTransform={handleResizeTransform}
        onTransformEnd={handleResizeEnd}
      />
      <Group
        ref={groupRef}
        x={card.position.x * MM_TO_PX}
        y={card.position.y * MM_TO_PX}
        width={w}
        height={h}
        clipFunc={(ctx) => { ctx.rect(0, 0, w, h) }}
        draggable
        dragDistance={3}
        onClick={(e) => onSelect(card.id, e)}
        onDblClick={() => onDoubleClick(card.id)}
        onDblTap={() => onDoubleClick(card.id)}
        onDragStart={(e) => {
          onDragStart(card.id, e.target.x(), e.target.y())
        }}
        onDragMove={(e) => {
          onDragMove(card.id, e.target.x(), e.target.y())
        }}
        onDragEnd={(e) => {
          onDragEnd(card.id, e.target.x(), e.target.y())
        }}
      >
        {!hasBorder && (
          <Rect width={w} height={h} fill={card.style.bodyBackgroundColor}
            cornerRadius={card.style.borderRadius ?? 4} />
        )}
        {hasBorder && (
          <>
            <Rect width={w} height={h} fill={card.style.borderColor}
              cornerRadius={card.style.borderRadius ?? 4} />
            <Rect x={card.style.borderWidth} y={card.style.borderWidth}
              width={w - 2 * card.style.borderWidth} height={h - 2 * card.style.borderWidth}
              fill={card.style.bodyBackgroundColor}
              cornerRadius={Math.max(0, (card.style.borderRadius ?? 4) - card.style.borderWidth)} />
          </>
        )}
        {hasTitle && (
          <>
            {!hasBorder && (
              <Rect
                width={w}
                height={titleHeight}
                fill={card.style.titleBackgroundColor}
                cornerRadius={[card.style.borderRadius ?? 4, card.style.borderRadius ?? 4, 0, 0]}
              />
            )}
            {hasBorder && (
              <Rect x={card.style.borderWidth} y={card.style.borderWidth}
                width={w - 2 * card.style.borderWidth} height={titleHeight}
                fill={card.style.titleBackgroundColor}
                cornerRadius={[Math.max(0, (card.style.borderRadius ?? 4) - card.style.borderWidth),
                  Math.max(0, (card.style.borderRadius ?? 4) - card.style.borderWidth), 0, 0]} />
            )}
            <Text
              x={10}
              y={hasBorder ? card.style.borderWidth : 0}
              width={w - 20}
              height={titleHeight}
              text={card.flags.showNumber && !card.flags.excludeFromNumbering ? `${cardNumber}. ${card.title}` : card.title}
              fontSize={titleFontSize}
              fontFamily={card.style.titleFont}
              fontStyle={card.style.titleBold ? 'bold' : 'normal'}
              fill={card.style.titleColor}
              ellipsis
              verticalAlign="middle"
            />
          </>
        )}
        {!card.flags.hideBody && (
        <RichTextBody
            content={card.content}
            x={10} y={hasTitle ? titleHeight + 9 : 3}
            maxWidth={w - 20} maxHeight={h - (hasTitle ? titleHeight + 12 : 6)}
          fontSize={bodyFontSize}
          fontFamily={card.style.bodyFont}
          defaultColor={card.style.bodyColor}
        />
        )}

        {isSelected && (
          <Rect
            width={w}
            height={h}
            fill="transparent"
            stroke="#1677ff"
            strokeWidth={2}
            dash={[4, 4]}
            cornerRadius={card.style.borderRadius ?? 4}
            listening={false}
          />
        )}
      </Group>
      {isSelected && <Transformer ref={trRef} rotateEnabled={false} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} keepRatio={false} boundBoxFunc={(_oldBox, newBox) => newBox} />}
    </>
  )
}

function charWidth(char: string, fontSize: number): number {
  const code = char.charCodeAt(0)
  if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) {
    return fontSize
  }
  return fontSize * 0.6
}

function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0
  for (const c of text) w += charWidth(c, fontSize)
  return w
}

function CanvasImage({ src, x, y, maxWidth, maxRemainingHeight, imageWidth, imageHeight }: {
  src: string
  x: number
  y: number
  maxWidth: number
  maxRemainingHeight: number
  imageWidth?: string
  imageHeight?: string
}) {
  const [image] = useImage(src)
  if (!image) return null
  let targetW = maxWidth
  let targetH = maxRemainingHeight
  if (imageWidth) {
    const parsed = parseFloat(imageWidth)
    if (imageWidth.endsWith('%')) {
      targetW = maxWidth * parsed / 100
    } else if (!isNaN(parsed)) {
      targetW = parsed
    }
  }
  const scale = Math.min(1, targetW / image.width)
  const displayW = image.width * scale
  let displayH = image.height * scale
  if (imageHeight) {
    const parsed = parseFloat(imageHeight)
    if (imageHeight.endsWith('%')) {
      displayH = maxRemainingHeight * parsed / 100
    } else if (!isNaN(parsed)) {
      displayH = parsed
    }
  }
  displayH = Math.min(displayH, maxRemainingHeight)
  return <KonvaImage image={image} x={x} y={y} width={displayW} height={displayH} />
}

const MATH_RENDER_SCALE = Math.max(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)

function useMathImage(latex: string, displayMode: boolean, fontSize: number = 16) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    let cancelled = false
    let div: HTMLDivElement | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const safeRemove = () => {
      if (timer) { clearTimeout(timer); timer = null }
      if (div && document.body.contains(div)) {
        document.body.removeChild(div)
        div = null
      }
    }
    try {
      const html = katex.renderToString(latex, { throwOnError: false, displayMode, output: 'html' })
      div = document.createElement('div')
      div.style.position = 'absolute'
      div.style.left = '-9999px'
      div.style.top = '0'
      div.style.padding = '4px'
      div.style.background = 'white'
      div.style.fontSize = `${fontSize}px`
      div.innerHTML = html
      document.body.appendChild(div)
      timer = setTimeout(() => {
        if (cancelled) { safeRemove(); return }
        html2canvas(div!, {
          backgroundColor: '#ffffff',
          scale: MATH_RENDER_SCALE,
          useCORS: true,
          logging: false,
        }).then(canvas => {
          if (cancelled) return
          const dataUrl = canvas.toDataURL('image/png')
          const img = new window.Image()
          img.onload = () => { if (!cancelled) setImage(img) }
          img.onerror = () => { safeRemove() }
          img.src = dataUrl
          safeRemove()
        }).catch((err) => {
          if (!cancelled) console.warn('公式渲染(html2canvas)失败:', err)
          safeRemove()
        })
      }, 30)
    } catch (err) {
      console.warn('公式渲染(KaTeX)失败:', err)
      safeRemove()
    }
    return () => { cancelled = true; safeRemove() }
  }, [latex, displayMode, fontSize])
  return image
}

function CanvasMath({ latex, x, y, maxWidth, maxRemainingHeight, fontSize = 16 }: {
  latex: string
  x: number
  y: number
  maxWidth: number
  maxRemainingHeight: number
  fontSize?: number
}) {
  const image = useMathImage(latex, false, fontSize)
  if (!image) return null
  const logicalW = image.width / MATH_RENDER_SCALE
  const logicalH = image.height / MATH_RENDER_SCALE
  const scale = Math.min(1, maxWidth / logicalW)
  const displayW = logicalW * scale
  const displayH = Math.min(logicalH * scale, maxRemainingHeight)
  return <KonvaImage image={image} x={x} y={y} width={displayW} height={displayH} />
}

function RichTextBody({ content, x, y, maxWidth, maxHeight, fontSize, fontFamily, defaultColor }: {
  content: Record<string, unknown>
  x: number
  y: number
  maxWidth: number
  maxHeight: number
  fontSize: number
  fontFamily: string
  defaultColor: string
}) {
  const lineHeight = fontSize * 1.5
  const parsedLines = parseRichText(content, defaultColor, fontSize)

  let cy = y
  const lh = lineHeight
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of parsedLines) {
    if (cy + lh > y + maxHeight) break
    const allSegments = line.segments
    if (allSegments.length === 0) {
      cy += lh
      continue
    }

    const imgSrc = allSegments[0]?.imageSrc
    const mathLatex = allSegments[0]?.latex
    if (mathLatex) {
      const mathMaxH = y + maxHeight - cy
      if (mathMaxH > 0) {
        const mathH = Math.min(fontSize * 1.8, mathMaxH)
        elements.push(
          <CanvasMath key={key++} latex={mathLatex} x={x} y={cy} maxWidth={maxWidth} maxRemainingHeight={mathMaxH} fontSize={fontSize} />
        )
        cy += mathH + 2
      }
      continue
    }
    if (imgSrc) {
      const imgMaxH = y + maxHeight - cy
      if (imgMaxH > 0) {
        const imgH = Math.min(maxWidth * 0.6, imgMaxH)
        elements.push(
          <CanvasImage key={key++} src={imgSrc} x={x} y={cy} maxWidth={maxWidth} maxRemainingHeight={imgMaxH} imageWidth={allSegments[0].imageWidth} imageHeight={allSegments[0].imageHeight} />
        )
        cy += imgH + 4
      }
      continue
    }

    const align = allSegments[0].align

    const visualLines: TextSegment[][] = []
    let currentLine: TextSegment[] = []
    let currentX = 0

    const flushVisualLines = () => {
      if (currentLine.length > 0) {
        visualLines.push(currentLine)
        currentLine = []
        currentX = 0
      }
      for (const vline of visualLines) {
        if (cy + lh > y + maxHeight) break
        const totalWidth = vline.reduce((acc, s) => acc + estimateTextWidth(s.text, s.fontSize), 0)
        let offsetX = 0
        if (align === 'center') offsetX = Math.max(0, (maxWidth - totalWidth) / 2)
        else if (align === 'right') offsetX = Math.max(0, maxWidth - totalWidth)

        let segX = x + offsetX
        for (const seg of vline) {
          const segW = estimateTextWidth(seg.text, seg.fontSize)
          let decoration: '' | 'underline' | 'line-through' = ''
          if (seg.underline) decoration = 'underline'
          else if (seg.strikethrough) decoration = 'line-through'
          elements.push(
            <Text
              key={key++}
              x={segX}
              y={cy}
              text={seg.text}
              fontSize={seg.fontSize}
              fontFamily={fontFamily}
              fontStyle={seg.bold && seg.italic ? 'bold italic' : seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal'}
              fill={seg.color}
              textDecoration={decoration}
            />
          )
          segX += segW
        }
        cy += lh
      }
      visualLines.length = 0
    }

    for (const seg of allSegments) {
      if (seg.latex) {
        flushVisualLines()
        const mathMaxH = y + maxHeight - cy
        if (mathMaxH > 0) {
          const mathH = Math.min(fontSize * 1.8, mathMaxH)
          elements.push(
            <CanvasMath key={key++} latex={seg.latex} x={x} y={cy} maxWidth={maxWidth} maxRemainingHeight={mathMaxH} fontSize={seg.fontSize || fontSize} />
          )
          cy += mathH + 2
        }
        continue
      }
      if (seg.imageSrc) {
        flushVisualLines()
        const imgMaxH = y + maxHeight - cy
        if (imgMaxH > 0) {
          const imgH = Math.min(maxWidth * 0.6, imgMaxH)
          elements.push(
            <CanvasImage key={key++} src={seg.imageSrc} x={x} y={cy} maxWidth={maxWidth} maxRemainingHeight={imgMaxH} imageWidth={seg.imageWidth} imageHeight={seg.imageHeight} />
          )
          cy += imgH + 4
        }
        continue
      }
      const segW = estimateTextWidth(seg.text, seg.fontSize)
      if (segW <= maxWidth && currentX + segW > maxWidth) {
        visualLines.push(currentLine)
        currentLine = []
        currentX = 0
      }
      if (segW <= maxWidth) {
        currentLine.push(seg)
        currentX += segW
      } else {
        let i = 0
        while (i < seg.text.length) {
          let j = i + 1
          while (j <= seg.text.length && estimateTextWidth(seg.text.slice(i, j), seg.fontSize) <= maxWidth) {
            j++
          }
          j--
          if (j <= i) j = i + 1
          if (currentX > 0 && currentX + estimateTextWidth(seg.text.slice(i, j), seg.fontSize) > maxWidth) {
            visualLines.push(currentLine)
            currentLine = []
            currentX = 0
          }
          const chunk = { ...seg, text: seg.text.slice(i, j) }
          currentLine.push(chunk)
          currentX += estimateTextWidth(chunk.text, seg.fontSize)
          i = j
        }
      }
    }
    flushVisualLines()
  }

  return <>{elements}</>
}

function PageElementRenderer({ element, isSelected, onSelect, onDragEnd, onTransformEnd }: {
  element: PageElement
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, x: number, y: number, w: number, h: number, rotation: number) => void
}) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  if (element.type === 'text') {
    const content = element.content as Record<string, unknown>
    const px = element.position.x * MM_TO_PX
    const py = element.position.y * MM_TO_PX
    const pw = element.size.width * MM_TO_PX
    const ph = element.size.height * MM_TO_PX
    return (
      <>
        <Group
          ref={groupRef}
          x={px}
          y={py}
          width={pw}
          height={ph}
          draggable
          onClick={() => onSelect(element.id)}
          onDragEnd={(e) => onDragEnd(element.id, e.target.x(), e.target.y())}
          onTransformEnd={() => {
            if (groupRef.current) {
              const node = groupRef.current
              const scaleX = node.scaleX()
              const scaleY = node.scaleY()
              node.scaleX(1)
              node.scaleY(1)
              onTransformEnd(element.id, node.x(), node.y(), pw * scaleX, ph * scaleY, node.rotation())
            }
          }}
        >
          <Rect
            width={pw}
            height={ph}
            fill={(content.backgroundColor as string) || 'transparent'}
            stroke={isSelected ? '#1677ff' : 'transparent'}
            strokeWidth={isSelected ? 1 : 0}
            dash={[4, 4]}
          />
          <Text
            x={4}
            y={4}
            width={pw - 8}
            height={ph - 8}
            text={(content.text as string) || ''}
            fontSize={(content.fontSize as number) || 16}
            fontFamily={(content.fontFamily as string) || 'Arial'}
            fill={(content.color as string) || '#000000'}
            fontStyle={(content.bold as boolean) ? 'bold' : 'normal'}
            align={(content.align as CanvasTextAlign) || 'left'}
          />
        </Group>
        {isSelected && <Transformer ref={trRef} rotateEnabled={false} />}
      </>
    )
  }

  if (element.type === 'red-box') {
    const style = element.style as Record<string, unknown>
    const px = element.position.x * MM_TO_PX
    const py = element.position.y * MM_TO_PX
    const pw = element.size.width * MM_TO_PX
    const ph = element.size.height * MM_TO_PX
    return (
      <>
        <Group
          ref={groupRef}
          x={px}
          y={py}
          width={pw}
          height={ph}
          draggable
          onClick={() => onSelect(element.id)}
          onDragEnd={(e) => onDragEnd(element.id, e.target.x(), e.target.y())}
          onTransformEnd={() => {
            if (groupRef.current) {
              const node = groupRef.current
              const scaleX = node.scaleX()
              const scaleY = node.scaleY()
              node.scaleX(1)
              node.scaleY(1)
              onTransformEnd(element.id, node.x(), node.y(), pw * scaleX, ph * scaleY, node.rotation())
            }
          }}
        >
          <Rect
            width={pw}
            height={ph}
            fill={(style.fill as string) || 'transparent'}
            stroke={(style.borderColor as string) || '#ff0000'}
            strokeWidth={(style.borderWidth as number) || 3}
          />
        </Group>
        {isSelected && <Transformer ref={trRef} rotateEnabled={false} />}
      </>
    )
  }

  if (element.type === 'arrow' || element.type === 'line') {
    return <ArrowLineRenderer element={element} isSelected={isSelected} onSelect={onSelect} />
  }

function ArrowLineRenderer({ element, isSelected, onSelect }: {
  element: PageElement
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd?: (id: string, x: number, y: number) => void
}) {
  const { updateElement } = usePageElementStore()
  const arrowRef = useRef<Konva.Arrow>(null)
  const lineRef = useRef<Konva.Line>(null)

  const style = element.style as Record<string, unknown>
  const strokeColor = (style.strokeColor as string) || '#ff0000'
  const strokeWidth = (style.strokeWidth as number) || 2
  const hideArrowHead = (style.hideArrowHead as boolean) || false

  const sx = element.position.x * MM_TO_PX
  const sy = element.position.y * MM_TO_PX
  const ex = (element.position.x + element.size.width) * MM_TO_PX
  const ey = (element.position.y + element.size.height) * MM_TO_PX

  const hitWidth = Math.max(strokeWidth + 10, 14)

  if (element.type === 'arrow') {
    return (
      <>
        <Arrow
          ref={arrowRef}
          points={[sx, sy, ex, ey]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          pointerLength={hideArrowHead ? 0 : 10}
          pointerWidth={hideArrowHead ? 0 : 8}
          fill={strokeColor}
          draggable
          hitStrokeWidth={hitWidth}
          onClick={() => onSelect(element.id)}
          onTap={() => onSelect(element.id)}
          onDragEnd={(e) => {
            const dx = e.target.x() / MM_TO_PX
            const dy = e.target.y() / MM_TO_PX
            updateElement(element.id, {
              position: { x: element.position.x + dx, y: element.position.y + dy },
            })
            e.target.x(0)
            e.target.y(0)
          }}
        />
        {isSelected && (
          <>
            <Circle
              x={sx} y={sy} radius={5} fill="white" stroke="#1677ff" strokeWidth={2} draggable
              onDragMove={(e) => {
                if (arrowRef.current) {
                  arrowRef.current.points([e.target.x(), e.target.y(), ex, ey])
                  e.target.getLayer()?.batchDraw()
                }
              }}
              onDragEnd={(e) => {
                const nx = e.target.x() / MM_TO_PX
                const ny = e.target.y() / MM_TO_PX
                const endX = element.position.x + element.size.width
                const endY = element.position.y + element.size.height
                updateElement(element.id, {
                  position: { x: nx, y: ny },
                  size: { width: endX - nx, height: endY - ny },
                })
                e.target.x(0)
                e.target.y(0)
              }}
            />
            <Circle
              x={ex} y={ey} radius={5} fill="white" stroke="#1677ff" strokeWidth={2} draggable
              onDragMove={(e) => {
                if (arrowRef.current) {
                  arrowRef.current.points([sx, sy, e.target.x(), e.target.y()])
                  e.target.getLayer()?.batchDraw()
                }
              }}
              onDragEnd={(e) => {
                const nx = e.target.x() / MM_TO_PX
                const ny = e.target.y() / MM_TO_PX
                updateElement(element.id, {
                  size: { width: nx - element.position.x, height: ny - element.position.y },
                })
                e.target.x(0)
                e.target.y(0)
              }}
            />
          </>
        )}
      </>
    )
  }

  return (
    <>
      <Line
        ref={lineRef}
        points={[sx, sy, ex, ey]}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        draggable
        hitStrokeWidth={hitWidth}
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
        onDragEnd={(e) => {
          const dx = e.target.x() / MM_TO_PX
          const dy = e.target.y() / MM_TO_PX
          updateElement(element.id, {
            position: { x: element.position.x + dx, y: element.position.y + dy },
          })
          e.target.x(0)
          e.target.y(0)
        }}
      />
      {isSelected && (
        <>
          <Circle
            x={sx} y={sy} radius={5} fill="white" stroke="#1677ff" strokeWidth={2} draggable
            onDragMove={(e) => {
              if (lineRef.current) {
                lineRef.current.points([e.target.x(), e.target.y(), ex, ey])
                e.target.getLayer()?.batchDraw()
              }
            }}
            onDragEnd={(e) => {
              const nx = e.target.x() / MM_TO_PX
              const ny = e.target.y() / MM_TO_PX
              const endX = element.position.x + element.size.width
              const endY = element.position.y + element.size.height
              updateElement(element.id, {
                position: { x: nx, y: ny },
                size: { width: endX - nx, height: endY - ny },
              })
              e.target.x(0)
              e.target.y(0)
            }}
          />
          <Circle
            x={ex} y={ey} radius={5} fill="white" stroke="#1677ff" strokeWidth={2} draggable
            onDragMove={(e) => {
              if (lineRef.current) {
                lineRef.current.points([sx, sy, e.target.x(), e.target.y()])
                e.target.getLayer()?.batchDraw()
              }
            }}
            onDragEnd={(e) => {
              const nx = e.target.x() / MM_TO_PX
              const ny = e.target.y() / MM_TO_PX
              updateElement(element.id, {
                size: { width: nx - element.position.x, height: ny - element.position.y },
              })
              e.target.x(0)
              e.target.y(0)
            }}
          />
        </>
      )}
    </>
  )
}

  if (element.type === 'image') {
    const content = element.content as Record<string, unknown>
    const style = element.style as Record<string, unknown>
    const [img] = useImage((content.src as string) || '')
    const px = element.position.x * MM_TO_PX
    const py = element.position.y * MM_TO_PX
    const pw = element.size.width * MM_TO_PX
    const ph = element.size.height * MM_TO_PX
    const elementOpacity = (style.opacity as number) ?? 1
    if (!img) return null
    return (
      <>
        <Group
          ref={groupRef}
          x={px}
          y={py}
          width={pw}
          height={ph}
          opacity={elementOpacity}
          draggable
          onClick={() => onSelect(element.id)}
          onDragEnd={(e) => onDragEnd(element.id, e.target.x(), e.target.y())}
          onTransformEnd={() => {
            if (groupRef.current) {
              const node = groupRef.current
              const scaleX = node.scaleX()
              const scaleY = node.scaleY()
              node.scaleX(1)
              node.scaleY(1)
              onTransformEnd(element.id, node.x(), node.y(), pw * scaleX, ph * scaleY, node.rotation())
            }
          }}
        >
          <KonvaImage
            image={img}
            width={pw}
            height={ph}
          />
        </Group>
        {isSelected && <Transformer ref={trRef} keepRatio={true} rotateEnabled={false} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} />}
      </>
    )
  }

  return null
}

function useImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = src
  }, [src])
  return [image]
}

export function CanvasView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const { cards, selectedCardIds, toggleCardSelection, updateCard } = useCardStore()
  const { pages, currentPageId } = usePageStore()
  const { zoom, offsetX, offsetY, setZoom, setOffset } = useCanvasStore()
  const { elements, selectedElementIds, addElement, updateElement, selectElement, clearSelection, loadElements, activeTool, setActiveTool } = usePageElementStore()
  const { openCardEditor } = useEditorStore()
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  const allPages = [...pages].sort((a, b) => a.order - b.order)

  useEffect(() => {
    if (allPages.length > 0) {
      for (const p of allPages) {
        loadElements(p.id)
      }
    }
  }, [pages, loadElements])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (allPages.length === 0) {
    return (
      <div className="canvas-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        请先选择或创建页面
      </div>
    )
  }

  const PAGE_GAP = 30

  const pageMetas = new Map<string, { pxWidth: number; pxHeight: number; pxSafeArea: CardRect; yOffset: number; safeAreaMM: CardRect }>()
  let yAccum = 20
  for (const page of allPages) {
    const dims = getPageDimensions(page)
    const sa = getSafeArea(page)
    const pw = dims.width * MM_TO_PX
    const ph = dims.height * MM_TO_PX
    pageMetas.set(page.id, {
      pxWidth: pw,
      pxHeight: ph,
      pxSafeArea: { x: sa.x * MM_TO_PX, y: sa.y * MM_TO_PX, w: sa.width * MM_TO_PX, h: sa.height * MM_TO_PX },
      yOffset: yAccum,
      safeAreaMM: { x: sa.x, y: sa.y, w: sa.width, h: sa.height },
    })
    yAccum += ph + PAGE_GAP
  }

  const defaultMeta = pageMetas.values().next().value || { pxWidth: 794, pxHeight: 1123, pxSafeArea: { x: 57, y: 57, w: 680, h: 1010 }, yOffset: 20, safeAreaMM: { x: 15, y: 15, w: 180, h: 267 } }

  const allPageCards = cards
    .filter(c => allPages.some(p => p.id === c.pageId))
    .sort((a, b) => a.order - b.order)

  const allElements = elements

  const [isPanning, setIsPanning] = useState(false)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const [isBoxSelecting, setIsBoxSelecting] = useState(false)
  const [boxSelectRect, setBoxSelectRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const boxSelectStart = useRef<{ x: number; y: number } | null>(null)
  const [snapLines, setSnapLines] = useState<Array<{ orientation: 'h' | 'v'; pos: number }>>([])
  const drawingRef = useRef<{ active: boolean; startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [drawingPreview, setDrawingPreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [textInputDialog, setTextInputDialog] = useState<{ x: number; y: number; mmX: number; mmY: number } | null>(null)
  const [showPngExportDialog, setShowPngExportDialog] = useState(false)
  const doExportCurrentPageRef = useRef<() => void>(() => {})
  const doExportAllAsOneRef = useRef<() => void>(() => {})
  const doExportPerPageRef = useRef<() => void>(() => {})

  useEffect(() => {
    const doFullLayout = async (layoutFn: typeof applyCompactLayout) => {
      const firstPageId = allPages[0]?.id
      if (!firstPageId) return

      const { cards: latestCards } = useCardStore.getState()

      const globalSorted = allPages
        .sort((a, b) => a.order - b.order)
        .flatMap(page =>
          latestCards.filter(c => c.pageId === page.id).sort((a, b) => a.order - b.order)
        )
      const globalOrderMap = new Map<string, number>()
      globalSorted.forEach((c, i) => globalOrderMap.set(c.id, i))

      let cards = latestCards.map(c => ({
        ...c,
        pageId: firstPageId,
        order: globalOrderMap.get(c.id) ?? 0,
      }))

      cards = await paginateAndLayout(cards, layoutFn)

      const pageGroups = new Map<string, Card[]>()
      for (const c of cards) {
        if (!pageGroups.has(c.pageId)) pageGroups.set(c.pageId, [])
        pageGroups.get(c.pageId)!.push(c)
      }
      for (const [, group] of pageGroups) {
        group.sort((a, b) => {
          const dy = a.position.y - b.position.y
          if (Math.abs(dy) > 10) return dy
          return a.position.x - b.position.x
        })
        for (let i = 0; i < group.length; i++) {
          group[i] = { ...group[i], order: i }
        }
      }

      useCardStore.setState({ cards })
      for (const c of cards) { updateCard(c.id, { pageId: c.pageId, position: c.position, order: c.order }) }
    }

    const layoutPage = (
      pageCards: Card[],
      page: Page,
      cards: Card[],
      layoutFn: typeof applyCompactLayout,
    ): Card[] => {
      const pc = pageCards.filter(c => !c.flags.excludeFromLayout).sort((a, b) => a.order - b.order)
      if (pc.length === 0) return cards
      const sa = getSafeArea(page)
      const safeRect: CardRect = { x: sa.x, y: sa.y, w: sa.width, h: sa.height }
      const pcRects = pc.map((c, i) => ({
        x: c.position.x, y: c.position.y,
        w: c.size.projectWidth, h: c.size.projectHeight,
        order: i, id: c.id,
      }))
      const laid = layoutFn(pcRects, safeRect, page.cardMinHSpacing || 5, page.cardMinVSpacing || 5)
      const lmap = new Map(laid.map(p => [p.id, p]))
      return cards.map(c => {
        const rp = lmap.get(c.id)
        return rp ? { ...c, position: { x: rp.x, y: rp.y }, updatedAt: Date.now() } : c
      })
    }

    const paginateAndLayout = async (cards: Card[], layoutFn: typeof applyCompactLayout): Promise<Card[]> => {
      const maxIter = 10
      const pageState = usePageStore.getState()

      for (let iter = 0; iter < maxIter; iter++) {
        const pages = [...pageState.pages].sort((a, b) => a.order - b.order)
        let anyMoved = false

        for (let pi = 0; pi < pages.length; pi++) {
          const page = pages[pi]
          cards = layoutPage(cards.filter(c => c.pageId === page.id), page, cards, layoutFn)

          const pageCards = cards.filter(c => c.pageId === page.id)
          const sa = getSafeArea(page)
          const rects = pageCards.map(c => ({
            x: c.position.x, y: c.position.y,
            w: c.size.projectWidth, h: c.size.projectHeight,
            id: c.id,
          }))
          const overflowIds = findOverflowCards(rects, { x: sa.x, y: sa.y, w: sa.width, h: sa.height }, 2)
          if (overflowIds.length === 0) continue

          anyMoved = true

          let nextPageId = pi + 1 < pages.length ? pages[pi + 1].id : null
          if (nextPageId) {
            const nextCards = cards.filter(c => c.pageId === nextPageId)
            if (nextCards.length > 0) nextPageId = null
          }

          if (!nextPageId) {
            const newPage = await pageState.createPage(page.projectId)
            nextPageId = newPage.id
            await pageState.updatePage(newPage.id, {
              size: page.size,
              orientation: page.orientation,
              margins: { ...page.margins },
              cardMinHSpacing: page.cardMinHSpacing,
              cardMinVSpacing: page.cardMinVSpacing,
              backgroundColor: page.backgroundColor,
              watermark: page.watermark ? { ...page.watermark } : undefined,
              pageNumber: page.pageNumber ? { ...page.pageNumber } : undefined,
              footer: page.footer ? { ...page.footer } : undefined,
            })
          }

          for (const oid of overflowIds) {
            const idx = cards.findIndex(c => c.id === oid)
            if (idx === -1) continue
            cards[idx] = { ...cards[idx], pageId: nextPageId, position: { x: 0, y: 0 }, updatedAt: Date.now() }
          }

          cards = layoutPage(cards.filter(c => c.pageId === page.id), page, cards, layoutFn)
        }

        if (!anyMoved) break
      }
      return cards
    }

    const handleAutoLayoutH = () => { doFullLayout(applyCompactLayout) }
    const handleAutoLayoutV = () => { doFullLayout(applyCompactLayoutVertical) }

    const exportPageRect = (pageId: string) => {
      const meta = pageMetas.get(pageId)
      if (!meta) return null
      return {
        x: 20,
        y: meta.yOffset,
        w: meta.pxWidth,
        h: meta.pxHeight,
        pageWidthMm: getPageDimensions(allPages.find(p => p.id === pageId) || allPages[0]).width,
      }
    }

    const captureRect = (rect: { x: number; y: number; w: number; h: number; pageWidthMm: number }) => {
      const { zoom: z, offsetX: ox, offsetY: oy } = useCanvasStore.getState()
      const sx = rect.x * z + ox
      const sy = rect.y * z + oy
      const sw = rect.w * z
      const sh = rect.h * z
      const targetPxWidth = rect.pageWidthMm * 300 / 25.4
      const pixelRatio = targetPxWidth / (rect.w * z)
      const layer = stageRef.current?.getLayers()[0]
      const guides = layer?.find('.page-guide') || []
      guides.forEach(g => g.visible(false))
      if (layer) layer.batchDraw()
      const dataUrl = stageRef.current!.toDataURL({ x: sx, y: sy, width: sw, height: sh, pixelRatio })
      guides.forEach(g => g.visible(true))
      if (layer) layer.batchDraw()
      return dataUrl
    }

    const triggerDownload = (dataUrl: string, filename: string) => {
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      link.click()
    }

    const getExportFilename = (suffix?: string) => {
      const projectName = useProjectStore.getState().projects.find(p => p.id === allPages[0]?.projectId)?.name || 'project'
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      return suffix ? `KnowCard_${projectName}_${suffix}_${dateStr}.png` : `KnowCard_${projectName}_${dateStr}.png`
    }

    const handleExportPNG = () => {
      if (allPages.length === 0) return
      setShowPngExportDialog(true)
    }

    const doExportCurrentPage = () => {
      if (!stageRef.current || !currentPageId) return
      const rect = exportPageRect(currentPageId)
      if (!rect) return
      const dataUrl = captureRect(rect)
      const page = allPages.find(p => p.id === currentPageId)
      triggerDownload(dataUrl, getExportFilename(page?.name))
      setShowPngExportDialog(false)
    }

    const doExportAllAsOne = () => {
      if (!stageRef.current || allPages.length === 0) return
      const { zoom: z, offsetX: ox, offsetY: oy } = useCanvasStore.getState()
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
      let pageWidthMm = 210
      for (const page of allPages) {
        const meta = pageMetas.get(page.id)
        if (!meta) continue
        const left = 20; const right = left + meta.pxWidth
        const top = meta.yOffset; const bottom = top + meta.pxHeight
        if (left < minX) minX = left
        if (top < minY) minY = top
        if (right > maxX) maxX = right
        if (bottom > maxY) maxY = bottom
        const dims = getPageDimensions(page)
        if (dims.width > pageWidthMm) pageWidthMm = dims.width
      }
      if (!isFinite(minX)) return
      const sx = minX * z + ox; const sy = minY * z + oy
      const sw = (maxX - minX) * z; const sh = (maxY - minY) * z
      const targetPxWidth = pageWidthMm * 300 / 25.4
      const pixelRatio = targetPxWidth / ((maxX - minX) * z)
      const dataUrl = stageRef.current.toDataURL({ x: sx, y: sy, width: sw, height: sh, pixelRatio })
      triggerDownload(dataUrl, getExportFilename())
      setShowPngExportDialog(false)
    }

    const doExportPerPage = () => {
      if (!stageRef.current || allPages.length === 0) return
      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i]
        const rect = exportPageRect(page.id)
        if (!rect) continue
        setTimeout(() => {
          const dataUrl = captureRect(rect)
          triggerDownload(dataUrl, getExportFilename(page.name))
        }, i * 300)
      }
      setShowPngExportDialog(false)
    }

    doExportCurrentPageRef.current = doExportCurrentPage
    doExportAllAsOneRef.current = doExportAllAsOne
    doExportPerPageRef.current = doExportPerPage

    const handlePrint = () => {
      if (!stageRef.current || allPages.length === 0) return
      const images: Array<{ dataUrl: string; name: string }> = []
      for (const page of allPages) {
        const rect = exportPageRect(page.id)
        if (!rect) continue
        const dataUrl = captureRect(rect)
        images.push({ dataUrl, name: page.name })
      }
      if (images.length === 0) return

      const win = window.open('', '_blank')
      if (!win) return
      const htmlParts = images.map(img =>
        `<div class="page"><img src="${img.dataUrl}" style="width:100%;height:auto" /></div>`
      )
      win.document.write(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>打印</title>
        <style>
          @page { size: A4; margin: 0; }
          @media print {
            body { margin: 0; padding: 0; background: none; }
            .page { page-break-after: always; width: 100%; box-shadow: none; background: none; }
            .page:last-child { page-break-after: auto; }
            img { display: block; width: 100%; height: auto; }
          }
          body { margin: 0; padding: 0; background: #fff; }
          .page { width: 100%; background: #fff; }
          .page img { display: block; width: 100%; height: auto; }
        </style></head>
        <body>${htmlParts.join('\n')}</body></html>
      `)
      win.document.close()
      setTimeout(() => win.print(), 800)
    }

    const handleToggleAllNumbers = (e: Event) => {
      const { show } = (e as CustomEvent).detail as { show: boolean }
      const state = useCardStore.getState()
      const newCards = state.cards.map(c => ({ ...c, flags: { ...c.flags, showNumber: show }, updatedAt: Date.now() }))
      useCardStore.setState({ cards: newCards })
      for (const c of newCards) { state.updateCard(c.id, { flags: c.flags }) }
    }

    const handleToggleAllBody = (e: Event) => {
      const { show } = (e as CustomEvent).detail as { show: boolean }
      const targetHide = !show
      const state = useCardStore.getState()
      const newCards = state.cards.map(c => ({ ...c, flags: { ...c.flags, hideBody: targetHide }, updatedAt: Date.now() }))
      useCardStore.setState({ cards: newCards })
      for (const c of newCards) { state.updateCard(c.id, { flags: c.flags }) }
    }

    const handleScrollToPage = (e: Event) => {
      const { pageId } = (e as CustomEvent).detail as { pageId: string }
      const meta = pageMetas.get(pageId)
      if (!meta) return
      const vpHeight = containerRef.current?.clientHeight || window.innerHeight
      const targetY = -(meta.yOffset * zoom) + vpHeight * 0.2
      const { offsetX: ox } = useCanvasStore.getState()
      useCanvasStore.getState().setOffset(ox, targetY)
      const { setCurrentPage } = usePageStore.getState()
      setCurrentPage(pageId)
    }

    const handleZoomToFit = () => {
      const vpWidth = containerRef.current?.clientWidth
      const vpHeight = containerRef.current?.clientHeight
      if (!vpWidth || !vpHeight) return

      let maxPageWidth = defaultMeta.pxWidth
      for (const meta of pageMetas.values()) {
        if (meta.pxWidth > maxPageWidth) maxPageWidth = meta.pxWidth
      }

      const contentWidth = maxPageWidth + 40
      const contentHeight = yAccum + 20

      useCanvasStore.getState().zoomToFit(vpWidth, vpHeight, contentWidth, contentHeight)
    }

    window.addEventListener('auto-layout-h', handleAutoLayoutH)
    window.addEventListener('auto-layout-v', handleAutoLayoutV)
    window.addEventListener('scroll-to-page', handleScrollToPage)
    window.addEventListener('toggle-all-numbers', handleToggleAllNumbers)
    window.addEventListener('toggle-all-body', handleToggleAllBody)
    window.addEventListener('export-png', handleExportPNG)
    window.addEventListener('print', handlePrint)
    window.addEventListener('zoom-to-fit', handleZoomToFit)

    return () => {
      window.removeEventListener('auto-layout-h', handleAutoLayoutH)
      window.removeEventListener('auto-layout-v', handleAutoLayoutV)
      window.removeEventListener('scroll-to-page', handleScrollToPage)
      window.removeEventListener('toggle-all-numbers', handleToggleAllNumbers)
      window.removeEventListener('toggle-all-body', handleToggleAllBody)
      window.removeEventListener('export-png', handleExportPNG)
      window.removeEventListener('print', handlePrint)
      window.removeEventListener('zoom-to-fit', handleZoomToFit)
    }
  }, [allPages, allPageCards, updateCard, currentPageId])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    if (e.evt.ctrlKey) {
      const stage = stageRef.current
      if (!stage) return
      const oldScale = stage.scaleX()
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const newScale = e.evt.deltaY > 0 ? oldScale / 1.1 : oldScale * 1.1
      const clampedScale = Math.max(0.1, Math.min(5, newScale))

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }

      const newX = pointer.x - mousePointTo.x * clampedScale
      const newY = pointer.y - mousePointTo.y * clampedScale

      setZoom(clampedScale)
      setOffset(newX, newY)
    } else {
      const newOffsetX = offsetX - e.evt.deltaX
      const newOffsetY = offsetY - e.evt.deltaY
      setOffset(newOffsetX, newOffsetY)
    }
  }, [offsetX, offsetY, setZoom, setOffset])

  const handleSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.ctrlKey || e.evt.metaKey) {
      toggleCardSelection(id)
    } else {
      useCardStore.setState({ selectedCardIds: [id] })
      clearSelection()
    }
  }, [toggleCardSelection, clearSelection])

  const handleDragStart = useCallback((id: string, x: number, y: number) => {
    dragStartPosModule.set(id, { x, y })
  }, [])

  const handleDragMove = useCallback((id: string, x: number, y: number) => {
    const { selectedCardIds } = useCardStore.getState()
    const draggedCard = allPageCards.find(c => c.id === id)
    if (!draggedCard) return

    if (selectedCardIds.includes(id) && selectedCardIds.length > 1) {
      const start = dragStartPosModule.get(id)
      if (start) {
        const ddx = x - start.x
        const ddy = y - start.y
        for (const sid of selectedCardIds) {
          if (sid === id) continue
          const g = cardGroupRefsModule.get(sid)
          if (g) {
            const other = allPageCards.find(c => c.id === sid)
            if (other) {
              g.x(other.position.x * MM_TO_PX + ddx)
              g.y(other.position.y * MM_TO_PX + ddy)
            }
          }
        }
      }
    }

    const g = cardGroupRefsModule.get(id)
    if (g) {
      g.x(x)
      g.y(y)
    }
  }, [allPageCards])

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    const startPos = dragStartPosModule.get(id)
    dragStartPosModule.delete(id)
    if (!startPos) return
    const deltaX = (x - startPos.x) / MM_TO_PX
    const deltaY = (y - startPos.y) / MM_TO_PX

    setSnapLines([])

    const selectedIds = selectedCardIds.includes(id) ? selectedCardIds : [id]
    const movedCards = allPageCards
      .filter(c => selectedIds.includes(c.id))
      .sort((a, b) => a.order - b.order)

    for (const card of movedCards) {
      const isDragged = card.id === id
      const rawX = isDragged ? x / MM_TO_PX : card.position.x + deltaX
      const rawY = isDragged ? y / MM_TO_PX : card.position.y + deltaY
      updateCard(card.id, { position: { x: rawX, y: rawY } })
    }
  }, [allPageCards, updateCard, selectedCardIds])

  const handleDoubleClick = useCallback((id: string) => {
    openCardEditor(id)
  }, [openCardEditor])

  const handleCardTransformEnd = useCallback((id: string, w: number, h: number, x: number, y: number) => {
    const card = allPageCards.find(c => c.id === id)
    if (!card) return
    const mmW = w / MM_TO_PX
    const mmH = h / MM_TO_PX
    const mmX = x / MM_TO_PX
    const mmY = y / MM_TO_PX
    updateCard(id, {
      size: { ...card.size, projectWidth: Math.round(mmW), projectHeight: Math.round(mmH) },
      position: { x: mmX, y: mmY },
    })
  }, [allPageCards, updateCard])

  const handleElementSelect = useCallback((id: string) => {
    selectElement(id)
    useCardStore.setState({ selectedCardIds: [] })
  }, [selectElement])

  const handleElementDragEnd = useCallback((id: string, x: number, y: number) => {
    updateElement(id, { position: { x: x / MM_TO_PX, y: y / MM_TO_PX } })
  }, [updateElement])

  const handleElementTransformEnd = useCallback((id: string, x: number, y: number, w: number, h: number, rotation: number) => {
    updateElement(id, {
      position: { x: x / MM_TO_PX, y: y / MM_TO_PX },
      size: { width: w / MM_TO_PX, height: h / MM_TO_PX },
      rotation,
    })
  }, [updateElement])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      if (boxSelectRect && boxSelectRect.w > 5 && boxSelectRect.h > 5) {
        return
      }
      if (activeTool && currentPageId && activeTool !== 'arrow') {
        if (activeTool === 'text') {
          useCardStore.setState({ selectedCardIds: [] })
          clearSelection()
          setTextInputDialog({ x: e.evt.clientX, y: e.evt.clientY, mmX: (e.target.getStage()!.getPointerPosition()!.x - 20) / MM_TO_PX, mmY: (e.target.getStage()!.getPointerPosition()!.y - 20) / MM_TO_PX })
          return
        }
        const stage = stageRef.current
        if (!stage) return
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        const mmX = (pointer.x - 20) / MM_TO_PX
        const mmY = (pointer.y - 20) / MM_TO_PX
        const activeMeta = pageMetas.get(currentPageId) || defaultMeta
        const activeSA = activeMeta.safeAreaMM
        useCardStore.setState({ selectedCardIds: [] })
        addElement(currentPageId, activeTool, { x: Math.max(activeSA.x, mmX), y: Math.max(activeSA.y, mmY) })
        setActiveTool(null)
      } else {
        useCardStore.setState({ selectedCardIds: [] })
        clearSelection()
      }
    }
  }, [activeTool, currentPageId, addElement, setActiveTool, clearSelection, boxSelectRect, pageMetas])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      if (activeTool === 'arrow' && currentPageId) {
        const stage = stageRef.current
        if (!stage) return
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        const stageX = pointer.x
        const stageY = pointer.y
        drawingRef.current = { active: true, startX: stageX, startY: stageY, currentX: stageX, currentY: stageY }
        setDrawingPreview({ x1: stageX, y1: stageY, x2: stageX, y2: stageY })
        return
      }
      if (e.evt.shiftKey) {
        const stage = stageRef.current
        if (!stage) return
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        const pos = { x: (pointer.x - 20), y: (pointer.y - 20) }
        boxSelectStart.current = pos
        setIsBoxSelecting(true)
        setBoxSelectRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
        useCardStore.setState({ selectedCardIds: [] })
        clearSelection()
      } else {
        setIsPanning(true)
        lastMousePos.current = { x: e.evt.clientX, y: e.evt.clientY }
      }
    }
  }, [activeTool, currentPageId, clearSelection])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (drawingRef.current?.active) {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      drawingRef.current.currentX = pointer.x
      drawingRef.current.currentY = pointer.y
      setDrawingPreview({ x1: drawingRef.current.startX, y1: drawingRef.current.startY, x2: pointer.x, y2: pointer.y })
      return
    }
    if (isBoxSelecting && boxSelectStart.current) {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const start = boxSelectStart.current
      const px = (pointer.x - 20)
      const py = (pointer.y - 20)
      const x = Math.min(start.x, px)
      const y = Math.min(start.y, py)
      const w = Math.abs(px - start.x)
      const h = Math.abs(py - start.y)
      setBoxSelectRect({ x, y, w, h })
      return
    }
    if (!isPanning) return
    const dx = e.evt.clientX - lastMousePos.current.x
    const dy = e.evt.clientY - lastMousePos.current.y
    lastMousePos.current = { x: e.evt.clientX, y: e.evt.clientY }
    setOffset(offsetX + dx, offsetY + dy)
  }, [isPanning, isBoxSelecting, offsetX, offsetY, setOffset])

  const handleMouseUp = useCallback(() => {
    if (drawingRef.current?.active && currentPageId && activeTool) {
      const d = drawingRef.current
      const dx = Math.abs(d.currentX - d.startX)
      const dy = Math.abs(d.currentY - d.startY)
      drawingRef.current = null
      setDrawingPreview(null)
      if (dx < 5 && dy < 5) {
        return
      }
      let pageId = currentPageId
      let pageYOff = 20
      for (const page of allPages) {
        const meta = pageMetas.get(page.id)
        if (meta && d.startY >= meta.yOffset && d.startY <= meta.yOffset + meta.pxHeight) {
          pageId = page.id
          pageYOff = meta.yOffset
          break
        }
      }
      const mmStartX = (d.startX - 20) / MM_TO_PX
      const mmStartY = (d.startY - pageYOff) / MM_TO_PX
      const mmEndX = (d.currentX - 20) / MM_TO_PX
      const mmEndY = (d.currentY - pageYOff) / MM_TO_PX
      useCardStore.setState({ selectedCardIds: [] })
      addElement(pageId, activeTool, { x: mmStartX, y: mmStartY }).then((el) => {
        updateElement(el.id, { size: { width: mmEndX - mmStartX, height: mmEndY - mmStartY } })
      })
      setActiveTool(null)
      return
    }
    if (isBoxSelecting && boxSelectRect) {
      const sr = boxSelectRect
      const selectionRect: CardRect = { x: sr.x / MM_TO_PX, y: sr.y / MM_TO_PX, w: sr.w / MM_TO_PX, h: sr.h / MM_TO_PX }
       const hitIds: string[] = []
       for (const card of allPageCards) {
         const cr: CardRect = { x: card.position.x, y: card.position.y, w: card.size.projectWidth, h: card.size.projectHeight }
        if (findOverlapping(selectionRect, [cr])) {
          hitIds.push(card.id)
        }
      }
      if (hitIds.length > 0) {
        useCardStore.setState({ selectedCardIds: hitIds })
      }
      setIsBoxSelecting(false)
      setBoxSelectRect(null)
      boxSelectStart.current = null
      return
    }
    setIsPanning(false)
    setIsBoxSelecting(false)
    setBoxSelectRect(null)
    boxSelectStart.current = null
  }, [isBoxSelecting, isPanning, boxSelectRect, allPageCards, currentPageId, activeTool, allPages, pageMetas, addElement, updateElement, setActiveTool])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setActiveTool(null)
      drawingRef.current = null
      setDrawingPreview(null)
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedElementIds.length > 0) {
        for (const id of selectedElementIds) {
          usePageElementStore.getState().deleteElement(id)
        }
      }
    }
  }, [selectedElementIds, setActiveTool])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!currentPageId) return
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (!blob) continue
        const reader = new FileReader()
        reader.onload = async (evt) => {
          const dataUrl = evt.target?.result as string
          const stage = stageRef.current
          if (!stage) return
          const pointer = stage.getPointerPosition()
          const pos = pointer || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }
          const mmX = (pos.x - 20) / MM_TO_PX
          const mmY = (pos.y - 20) / MM_TO_PX
          const pasteMeta = pageMetas.get(currentPageId) || defaultMeta
          const pasteSA = pasteMeta.safeAreaMM
          const element = await addElement(currentPageId, 'image', { x: Math.max(pasteSA.x, mmX), y: Math.max(pasteSA.y, mmY) })
          const img = new window.Image()
          img.onload = () => {
            const wMm = Math.round(img.width / MM_TO_PX * 10) / 10
            const hMm = Math.round(img.height / MM_TO_PX * 10) / 10
            updateElement(element.id, { content: { src: dataUrl }, size: { width: wMm, height: hMm } })
          }
          img.src = dataUrl
        }
        reader.readAsDataURL(blob)
      }
    }
  }, [currentPageId, addElement, updateElement])

  const globalNumberingMap = useMemo(() => {
    const map = new Map<string, number>()
    let gnum = 1
    const allSortedByPageThenOrder = allPages
      .sort((a, b) => a.order - b.order)
      .flatMap(page => allPageCards.filter(c => c.pageId === page.id).sort((a, b) => a.order - b.order))
    for (const pc of allSortedByPageThenOrder) {
      if (!pc.flags.excludeFromNumbering) map.set(pc.id, gnum++)
    }
    return map
  }, [allPages, allPageCards])

  return (
    <div className="canvas-view" ref={containerRef} onKeyDown={handleKeyDown} onPaste={handlePaste} tabIndex={0} style={{ outline: 'none' }}>
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={zoom}
        scaleY={zoom}
        x={offsetX}
        y={offsetY}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
      >
        <Layer>
          {allPages.map((page, pageIndex) => {
            const meta = pageMetas.get(page.id) || defaultMeta
            const pxW = meta.pxWidth
            const pxH = meta.pxHeight
            const psa = meta.pxSafeArea
            const yOff = meta.yOffset

            const pageCardsList = allPageCards.filter(c => c.pageId === page.id).sort((a, b) => a.order - b.order)

            const pageElements = allElements.filter(e => e.pageId === page.id)

            const cardsKey = pageCardsList.map(c => c.id).join(',')
            const showCards = pageCardsList.length > 0

            return (
              <Group key={page.id} x={20} y={yOff}>
                <Rect x={0} y={0} width={pxW} height={pxH} fill={page.backgroundColor || '#ffffff'} shadowColor="#000000" shadowBlur={10} shadowOpacity={0.15} shadowOffset={{ x: 2, y: 2 }} listening={true} onClick={() => {
                  const { setCurrentPage } = usePageStore.getState()
                  setCurrentPage(page.id)
                  useCardStore.setState({ selectedCardIds: [] })
                  usePageElementStore.getState().clearSelection()
                }} />
                <Rect x={psa.x} y={psa.y} width={psa.w} height={psa.h} stroke="#e0e0e0" strokeWidth={0.5} dash={[4, 4]} listening={false} name="page-guide" />

                {page.watermark?.enabled && page.watermark.text && (
                  <>
                    {(() => {
                      const marks: React.ReactNode[] = []
                      const spacing = (page.watermark.spacing || 100) * MM_TO_PX
                      const stepX = spacing
                      const stepY = spacing
                      const fontSizePx = (page.watermark.fontSize || 48)
                      const startY = psa.y + fontSizePx * 5
                      const textEstimate = fontSizePx * 3
                      for (let x = psa.x; x < psa.x + psa.w - textEstimate; x += stepX) {
                        for (let y = startY; y < psa.y + psa.h; y += stepY) {
                          marks.push(<Text key={`${x}-${y}`} x={x} y={y} text={page.watermark.text} fontSize={fontSizePx} fontFamily="Arial" fill={page.watermark.color || '#000000'} opacity={page.watermark.opacity || 0.1} rotation={-45} />)
                        }
                      }
                      return marks
                    })()}
                  </>
                )}

                {pageCardsList.map((card) => (
                  <CardRenderer key={card.id} card={card} cardNumber={globalNumberingMap.get(card.id) ?? 1} isSelected={selectedCardIds.includes(card.id)} onSelect={handleSelect} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDoubleClick={handleDoubleClick} onTransformEnd={handleCardTransformEnd} />
                ))}

                {page.pageNumber?.enabled && (() => {
                  const pn = page.pageNumber
                  const placement = pn.position || 'bottom-center'
                  const pageNum = `${pageIndex + 1}`
                  const size = pn.size || 12
                  const font = pn.font || 'Arial'
                  const color = pn.color || '#000000'
                  const margin = 9 * MM_TO_PX
                  let nx: number, ny: number
                  if (placement.startsWith('top')) ny = margin
                  else ny = pxH - margin - size
                  if (placement.endsWith('left')) nx = margin
                  else if (placement.endsWith('right')) nx = pxW - margin - 40
                  else nx = pxW / 2 - 20
                  return <Text x={nx} y={ny} text={pageNum} fontSize={size} fontFamily={font} fill={color} />
                })()}

                {page.footer?.enabled && page.footer.text && (() => {
                  const ft = page.footer
                  const size = ft.size || 10
                  const font = ft.font || 'Arial'
                  const color = ft.color || '#000000'
                  const position = ft.position || 'center'
                  const margin = 9 * MM_TO_PX
                  const footerWidth = 600
                  let fx: number
                  if (position === 'left') fx = margin
                  else if (position === 'right') fx = pxW - margin - footerWidth
                  else fx = pxW / 2 - footerWidth / 2
                  const fy = pxH - margin - size
                  return <Text x={fx} y={fy} width={footerWidth} text={ft.text} fontSize={size} fontFamily={font} fill={color} align={position === 'center' ? 'center' : position === 'right' ? 'right' : 'left'} />
                })()}
              </Group>
            )
          })}

          {allPages.map((page) => {
            const meta = pageMetas.get(page.id)
            if (!meta) return null
            const pageElements = allElements.filter(e => e.pageId === page.id)
            if (pageElements.length === 0) return null
            return (
              <Group key={`elem-${page.id}`} x={20} y={meta.yOffset}>
                {pageElements.map((element) => (
                  <PageElementRenderer key={element.id} element={element} isSelected={selectedElementIds.includes(element.id)} onSelect={handleElementSelect} onDragEnd={handleElementDragEnd} onTransformEnd={handleElementTransformEnd} />
                ))}
              </Group>
            )
          })}

          {drawingPreview && activeTool === 'arrow' && (
            <Arrow
              points={[drawingPreview.x1, drawingPreview.y1, drawingPreview.x2, drawingPreview.y2]}
              stroke="#1677ff"
              strokeWidth={2}
              pointerLength={10}
              pointerWidth={8}
              fill="#1677ff"
              dash={[6, 4]}
              listening={false}
            />
          )}

          {snapLines.map((line, i) => (
            <Line key={`snap-${i}`} points={line.orientation === 'v' ? [line.pos, 0, line.pos, defaultMeta.pxWidth] : [0, line.pos, defaultMeta.pxWidth, line.pos]} stroke="#1677ff" strokeWidth={1} dash={[4, 4]} listening={false} />
          ))}

          {boxSelectRect && (
            <Rect x={boxSelectRect.x} y={boxSelectRect.y} width={boxSelectRect.w} height={boxSelectRect.h} fill="rgba(22, 119, 255, 0.1)" stroke="#1677ff" strokeWidth={1} dash={[4, 4]} listening={false} />
          )}
        </Layer>
      </Stage>
      {activeTool && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--accent-color)',
          color: '#fff',
          padding: '6px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          zIndex: 10,
        }}>
          {activeTool === 'arrow'
            ? '在画布上拖拽绘制箭头'
            : `点击画布放置${activeTool === 'text' ? '文本框' : activeTool === 'image' ? '图片' : '红色方框'}`
          }
          {' '}(ESC 取消)
        </div>
      )}
      {textInputDialog && (
        <TextInputDialog
          initialX={textInputDialog.x}
          initialY={textInputDialog.y}
          onConfirm={(text, align) => {
            if (!currentPageId) return
            const size = computeTextElementSize(text)
            addElement(currentPageId, 'text', { x: Math.max(0, textInputDialog.mmX), y: Math.max(0, textInputDialog.mmY) }).then((el) => {
              usePageElementStore.getState().updateElement(el.id, {
                content: { text, align, fontSize: 26, fontFamily: 'Arial', color: '#000000', bold: false },
                size,
              })
            })
            setTextInputDialog(null)
            setActiveTool(null)
          }}
          onCancel={() => {
            setTextInputDialog(null)
            setActiveTool(null)
          }}
        />
      )}
      {showPngExportDialog && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPngExportDialog(false) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '420px', maxWidth: '90%' }}>
            <div className="modal-header">
              <h3>导出 PNG</h3>
              <button onClick={() => setShowPngExportDialog(false)} style={{ fontSize: 20, padding: '0 8px' }}>×</button>
            </div>
            <div style={{ padding: '20px 48px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
              <button className="btn-primary" onClick={() => doExportCurrentPageRef.current()} style={{ padding: '14px 20px', fontSize: 16, textAlign: 'left' }}>
                📄 导出当前页面
              </button>
              <button className="btn-primary" onClick={() => doExportAllAsOneRef.current()} style={{ padding: '14px 20px', fontSize: 16, textAlign: 'left' }}>
                📐 导出所有页面为一张图
              </button>
              <button className="btn-primary" onClick={() => doExportPerPageRef.current()} style={{ padding: '14px 20px', fontSize: 16, textAlign: 'left' }}>
                📑 逐页导出
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowPngExportDialog(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
