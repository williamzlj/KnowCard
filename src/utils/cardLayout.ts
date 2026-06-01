export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function applyCompactLayout(
  cards: Array<Rect & { order: number; id: string }>,
  safeArea: Rect,
  minHSpacing: number,
  minVSpacing: number,
): Array<Rect & { order: number; id: string }> {
  const sorted = [...cards].sort((a, b) => a.order - b.order)
  const placed: Rect[] = []

  for (const card of sorted) {
    const w = card.w
    const h = card.h

    if (placed.length === 0) {
      placed.push({ x: safeArea.x, y: safeArea.y, w, h })
      continue
    }

    let bestX = safeArea.x
    let minY = Infinity

    for (let cx = safeArea.x; cx + w <= safeArea.x + safeArea.w; cx += 1) {
      let rowY = safeArea.y
      for (const p of placed) {
        if (cx < p.x + p.w + minHSpacing && cx + w > p.x - minHSpacing) {
          rowY = Math.max(rowY, p.y + p.h + minVSpacing)
        }
      }
      if (rowY + h <= safeArea.y + safeArea.h && rowY < minY) {
        minY = rowY
        bestX = cx
      }
    }

    if (minY === Infinity) {
      placed.push({ x: bestX, y: safeArea.y + safeArea.h, w, h })
    } else {
      placed.push({ x: bestX, y: minY, w, h })
    }
  }

  return sorted.map((card, i) => ({
    ...card,
    x: placed[i].x,
    y: placed[i].y,
  }))
}

export function applyCompactLayoutVertical(
  cards: Array<Rect & { order: number; id: string }>,
  safeArea: Rect,
  minHSpacing: number,
  minVSpacing: number,
): Array<Rect & { order: number; id: string }> {
  const sorted = [...cards].sort((a, b) => a.order - b.order)
  const placed: Rect[] = []
  const columns: Array<{ x: number; colWidth: number; bottomY: number }> = []

  for (const card of sorted) {
    const w = card.w
    const h = card.h

    if (placed.length === 0) {
      placed.push({ x: safeArea.x, y: safeArea.y, w, h })
      columns.push({ x: safeArea.x, colWidth: w, bottomY: safeArea.y + h })
      continue
    }

    let bestColIdx = -1
    let bestY = Infinity

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const candidateY = col.bottomY + minVSpacing
      if (candidateY + h <= safeArea.y + safeArea.h && candidateY < bestY) {
        bestY = candidateY
        bestColIdx = i
      }
    }

    if (bestColIdx >= 0) {
      const col = columns[bestColIdx]
      placed.push({ x: col.x, y: bestY, w, h })
      col.bottomY = bestY + h
    } else {
      let maxRight = safeArea.x
      for (const col of columns) {
        const colRight = col.x + col.colWidth
        if (colRight > maxRight) maxRight = colRight
      }
      const nextX = maxRight + minHSpacing

      if (nextX + w <= safeArea.x + safeArea.w) {
        placed.push({ x: nextX, y: safeArea.y, w, h })
        columns.push({ x: nextX, colWidth: w, bottomY: safeArea.y + h })
      } else {
        placed.push({ x: safeArea.x + safeArea.w - w, y: safeArea.y + safeArea.h, w, h })
      }
    }
  }

  return sorted.map((card, i) => ({
    ...card,
    x: placed[i].x,
    y: placed[i].y,
  }))
}

export function findCardsInRect(
  selectionRect: Rect,
  allCards: Rect[],
): number[] {
  const result: number[] = []
  for (let i = 0; i < allCards.length; i++) {
    if (checkCollision(selectionRect, allCards[i])) {
      result.push(i)
    }
  }
  return result
}

export function findOverflowCards(
  cardRects: Array<Rect & { id: string }>,
  safeArea: Rect,
  tolerance: number = 0,
): string[] {
  const overflow: string[] = []
  for (const cr of cardRects) {
    if (
      cr.x < safeArea.x - tolerance ||
      cr.y < safeArea.y - tolerance ||
      cr.x + cr.w > safeArea.x + safeArea.w + tolerance ||
      cr.y + cr.h > safeArea.y + safeArea.h + tolerance
    ) {
      overflow.push(cr.id)
    }
  }
  return overflow
}

export function fitCardToPage(
  cardRect: Rect,
  safeArea: Rect,
): Rect {
  let { x, y, w, h } = cardRect
  if (w > safeArea.w) w = safeArea.w
  if (h > safeArea.h) h = safeArea.h
  if (x < safeArea.x) x = safeArea.x
  if (y < safeArea.y) y = safeArea.y
  if (x + w > safeArea.x + safeArea.w) x = safeArea.x + safeArea.w - w
  if (y + h > safeArea.y + safeArea.h) y = safeArea.y + safeArea.h - h
  return { x, y, w, h }
}

export function checkCollision(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function findOverlapping(rectA: Rect, rectBArray: Rect[]): boolean {
  for (const rectB of rectBArray) {
    if (checkCollision(rectA, rectB)) {
      return true
    }
  }
  return false
}

export function snapToEdges(
  rect: Rect,
  otherCards: Rect[],
  safeArea: Rect,
  snapThreshold: number = 5,
): Rect {
  let { x, y, w, h } = rect
  
  const edges = [
    { edge: 'left', val: safeArea.x },
    { edge: 'right', val: safeArea.x + safeArea.w },
    { edge: 'center', val: safeArea.x + safeArea.w / 2 },
  ]
  
  for (const e of edges) {
    if (Math.abs(x - e.val) < snapThreshold) { x = e.val }
    if (Math.abs(x + w - e.val) < snapThreshold) { x = e.val - w }
  }
  
  for (const other of otherCards) {
    if (Math.abs(x - (other.x + other.w)) < snapThreshold) { x = other.x + other.w }
    if (Math.abs(x + w - other.x) < snapThreshold) { x = other.x - w }
  }
  
  const vEdges = [
    { edge: 'top', val: safeArea.y },
    { edge: 'bottom', val: safeArea.y + safeArea.h },
    { edge: 'center', val: safeArea.y + safeArea.h / 2 },
  ]
  
  for (const e of vEdges) {
    if (Math.abs(y - e.val) < snapThreshold) { y = e.val }
    if (Math.abs(y + h - e.val) < snapThreshold) { y = e.val - h }
  }
  
  for (const other of otherCards) {
    if (Math.abs(y - (other.y + other.h)) < snapThreshold) { y = other.y + other.h }
    if (Math.abs(y + h - other.y) < snapThreshold) { y = other.y - h }
  }
  
  return { x, y, w, h }
}

export function clampToSafeArea(rect: Rect, safeArea: Rect): Rect {
  return fitCardToPage(rect, safeArea)
}