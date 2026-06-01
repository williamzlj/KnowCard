import { useState, useRef, useEffect, useCallback } from 'react'

interface CropDialogProps {
  isOpen: boolean
  src: string
  onClose: () => void
  onCrop: (croppedDataUrl: string) => void
}

export function CropDialog({ isOpen, src, onClose, onCrop }: CropDialogProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [dragging, setDragging] = useState<'none' | 'start' | 'move' | 'end'>('none')
  const [moveStart, setMoveStart] = useState({ x: 0, y: 0, cx: 0, cy: 0, cw: 0, ch: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setImgLoaded(false)
      setCrop({ x: 0, y: 0, w: 0, h: 0 })
    }
  }, [isOpen])

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container) return
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    setImgNatural({ w: nw, h: nh })
    const maxW = container.clientWidth - 40
    const maxH = container.clientHeight - 40
    let dw = nw
    let dh = nh
    if (dw > maxW) { dh = (maxW / dw) * dh; dw = maxW }
    if (dh > maxH) { dw = (maxH / dh) * dw; dh = maxH }
    setDisplaySize({ w: Math.round(dw), h: Math.round(dh) })
    setCrop({ x: 0, y: 0, w: Math.round(dw * 0.8), h: Math.round(dh * 0.8) })
    setImgLoaded(true)
  }, [])

  const getNaturalRect = () => {
    const scaleW = imgNatural.w / displaySize.w
    const scaleH = imgNatural.h / displaySize.h
    return {
      x: Math.round(crop.x * scaleW),
      y: Math.round(crop.y * scaleH),
      w: Math.round(crop.w * scaleW),
      h: Math.round(crop.h * scaleH),
    }
  }

  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'move' | 'end') => {
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).closest('.crop-canvas')?.getBoundingClientRect()
    if (!rect) return
    setDragging(handle)
    setMoveStart({
      x: e.clientX,
      y: e.clientY,
      cx: crop.x,
      cy: crop.y,
      cw: crop.w,
      ch: crop.h,
    })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === 'none') return
    const rect = containerRef.current?.querySelector('.crop-canvas')?.getBoundingClientRect()
    if (!rect) return
    const dx = e.clientX - moveStart.x
    const dy = e.clientY - moveStart.y
    const maxW = displaySize.w
    const maxH = displaySize.h

    if (dragging === 'move') {
      let nx = moveStart.cx + dx
      let ny = moveStart.cy + dy
      if (nx < 0) nx = 0
      if (ny < 0) ny = 0
      if (nx + moveStart.cw > maxW) nx = maxW - moveStart.cw
      if (ny + moveStart.ch > maxH) ny = maxH - moveStart.ch
      setCrop({ x: Math.round(nx), y: Math.round(ny), w: moveStart.cw, h: moveStart.ch })
    } else if (dragging === 'start') {
      const nw = moveStart.cw - dx
      const nh = moveStart.ch - dy
      let nx = moveStart.cx + dx
      let ny = moveStart.cy + dy
      if (nx < 0) nx = 0
      if (ny < 0) ny = 0
      if (nw < 20) { nx = moveStart.cx + moveStart.cw - 20 }
      if (nh < 20) { ny = moveStart.cy + moveStart.ch - 20 }
      setCrop({ x: Math.round(nx), y: Math.round(ny), w: Math.max(20, Math.round(nw)), h: Math.max(20, Math.round(nh)) })
    } else if (dragging === 'end') {
      setCrop({
        x: Math.round(moveStart.cx),
        y: Math.round(moveStart.cy),
        w: Math.max(20, Math.round(moveStart.cw + dx)),
        h: Math.max(20, Math.round(moveStart.ch + dy)),
      })
    }
  }, [dragging, moveStart, displaySize])

  useEffect(() => {
    if (dragging === 'none') return
    const handleUp = () => setDragging('none')
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, handleMouseMove])

  const applyCrop = () => {
    const nr = getNaturalRect()
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = nr.w
    canvas.height = nr.h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, nr.x, nr.y, nr.w, nr.h, 0, 0, nr.w, nr.h)
    onCrop(canvas.toDataURL('image/png'))
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '700px', maxWidth: '90%' }}>
        <div className="modal-header">
          <h3>裁剪图片</h3>
          <button onClick={onClose} style={{ fontSize: 20, padding: '0 8px' }}>×</button>
        </div>
        <div ref={containerRef} style={{ position: 'relative', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, background: '#1a1a1a', userSelect: 'none' }}>
          <div className="crop-canvas" style={{ position: 'relative', display: 'inline-block' }}>
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={handleImageLoad}
              style={{ display: 'block', width: displaySize.w || 'auto', height: displaySize.h || 'auto', opacity: imgLoaded ? 1 : 0 }}
              draggable={false}
            />
            {imgLoaded && (
              <>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute',
                  left: crop.x, top: crop.y,
                  width: crop.w, height: crop.h,
                  border: '2px dashed #fff',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  cursor: 'move',
                }}
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                >
                  <div style={{ position: 'absolute', left: -6, top: -6, width: 12, height: 12, background: '#fff', border: '2px solid #1677ff', cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'start')} />
                  <div style={{ position: 'absolute', right: -6, top: -6, width: 12, height: 12, background: '#fff', border: '2px solid #1677ff', cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'end')} />
                  <div style={{ position: 'absolute', left: -6, bottom: -6, width: 12, height: 12, background: '#fff', border: '2px solid #1677ff', cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'end')} />
                  <div style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, background: '#fff', border: '2px solid #1677ff', cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'end')} />
                </div>
                <div style={{
                  position: 'absolute', right: crop.x + crop.w + 8, top: crop.y,
                  color: '#fff', fontSize: 11, background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 3,
                }}>
                  {getNaturalRect().w}×{getNaturalRect().h}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={applyCrop} disabled={!imgLoaded} style={{ marginLeft: 8 }}>
            确认裁剪
          </button>
        </div>
      </div>
    </div>
  )
}
