import { useCardStore, usePageStore, useProjectStore } from '../../stores'
import { usePageElementStore } from '../../stores/usePageElementStore'
import { ALLOWED_FONTS } from '../../types/card'
import type { Page, PageNumberSettings } from '../../types/page'
import { getSafeArea } from '../../types/page'
import { ColorPicker } from '../color/ColorPicker'
import { calcCardSize, calcCardHeight, PX_PER_MM } from '../../utils/cardSize'
import { ImeSafeInput } from '../common/ImeSafeInput'
import { StyleLibraryDialog } from '../card/StyleLibraryDialog'
import { ContentLibraryDialog } from '../card/ContentLibraryDialog'
import { SizeLibraryDialog } from '../card/SizeLibraryDialog'
import { CropDialog } from '../canvas/CropDialog'
import { useState } from 'react'
import {
  Scissors,
  Copy,
  Trash2,
  Palette,
  FolderOpen,
  Ruler,
  Copy as CopyIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardCopy,
  Database
} from 'lucide-react'

let clipboardWidth: number | null = null
let clipboardHeight: number | null = null

export function PropertyPanel() {
  const { cards, selectedCardIds, updateCard, deleteCard, duplicateCard, copyCardStyle, pasteCardStyle, applyStyleToAll, createCardsFromPresets } = useCardStore()
  const [styleLibraryOpen, setStyleLibraryOpen] = useState(false)
  const [contentLibraryOpen, setContentLibraryOpen] = useState(false)
  const [sizeLibraryOpen, setSizeLibraryOpen] = useState(false)
  const [lockImageRatio, setLockImageRatio] = useState(true)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const { pages, currentPageId, updatePage } = usePageStore()
  const { currentProjectId } = useProjectStore()
  const { elements, selectedElementIds, updateElement, deleteElement, duplicateElement, copyElementToPage } = usePageElementStore()

  const selectedCard = selectedCardIds.length >= 1 ? cards.find(c => c.id === selectedCardIds[0]) : null
  const selectedCards = selectedCardIds.length > 1 ? cards.filter(c => selectedCardIds.includes(c.id)) : []
  const batchTargets = selectedCards.length > 0 ? selectedCards : (selectedCard ? [selectedCard] : [])
  const selectedElement = selectedElementIds.length === 1 ? elements.find(e => e.id === selectedElementIds[0]) : null
  const currentPage = pages.find(p => p.id === currentPageId)

  const sortedPages = [...pages].sort((a, b) => a.order - b.order)
  const isFirstPage = sortedPages.length > 0 && sortedPages[0].id === currentPageId
  const pageSettingsHint = isFirstPage ? '首页设置' : '第2页及后续页面设置'

  const updatePageSettings = (updates: Partial<Page>) => {
    if (isFirstPage) {
      updatePage(currentPage!.id, updates)
    } else {
      const subsequentPages = sortedPages.filter((_, i) => i > 0)
      for (const p of subsequentPages) {
        updatePage(p.id, updates)
      }
    }
  }

  if (!currentPage) return (
    <div className="property-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      请先选择页面
    </div>
  )

  if (selectedElement && selectedElement.type === 'arrow') {
    const style = selectedElement.style as Record<string, unknown>
    const btnStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, border: '1px solid var(--border-color)', cursor: 'pointer' }

    return (
      <div className="property-panel">
        <div className="panel-section">
          <h4>箭头属性</h4>
          <div className="form-row">
            <div className="form-group">
              <label>颜色</label>
              <ColorPicker value={(style.strokeColor as string) || '#ff0000'} onChange={(color) => updateElement(selectedElement.id, { style: { ...style, strokeColor: color } })} />
            </div>
            <div className="form-group">
              <label>粗细</label>
              <input type="number" min={1} max={20} step={0.5} value={(style.strokeWidth as number) || 2} onChange={(e) => updateElement(selectedElement.id, { style: { ...style, strokeWidth: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={(style.hideArrowHead as boolean) || false} onChange={(e) => updateElement(selectedElement.id, { style: { ...style, hideArrowHead: e.target.checked } })} />
              {' '}隐藏箭头标记（仅保留直线）
            </label>
          </div>
          <div className="form-group">
            <label>所属页面</label>
            <select
              value={selectedElement.pageId}
              onChange={(e) => updateElement(selectedElement.id, { pageId: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>复制到其他页面相同位置</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  copyElementToPage(selectedElement.id, e.target.value)
                  e.target.value = ''
                }
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              <option value="">选择页面...</option>
              {pages.filter(p => p.id !== selectedElement.pageId).map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => duplicateElement(selectedElement.id)}
              style={{ ...btnStyle, background: 'var(--bg-tertiary)' }}
            >
              复制箭头
            </button>
            <button
              onClick={() => {
                if (confirm('确定删除此箭头？')) {
                  deleteElement(selectedElement.id)
                }
              }}
              style={{ ...btnStyle, background: 'var(--danger-color)', color: '#fff' }}
            >
              删除箭头
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selectedElement && selectedElement.type === 'line') {
    const style = selectedElement.style as Record<string, unknown>
    const btnStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, border: '1px solid var(--border-color)', cursor: 'pointer' }

    return (
      <div className="property-panel">
        <div className="panel-section">
          <h4>线条属性</h4>
          <div className="form-row">
            <div className="form-group">
              <label>颜色</label>
              <ColorPicker value={(style.strokeColor as string) || '#ff0000'} onChange={(color) => updateElement(selectedElement.id, { style: { ...style, strokeColor: color } })} />
            </div>
            <div className="form-group">
              <label>粗细</label>
              <input type="number" min={1} max={20} step={0.5} value={(style.strokeWidth as number) || 2} onChange={(e) => updateElement(selectedElement.id, { style: { ...style, strokeWidth: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="form-group">
            <label>所属页面</label>
            <select
              value={selectedElement.pageId}
              onChange={(e) => updateElement(selectedElement.id, { pageId: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>复制到其他页面相同位置</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  copyElementToPage(selectedElement.id, e.target.value)
                  e.target.value = ''
                }
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              <option value="">选择页面...</option>
              {pages.filter(p => p.id !== selectedElement.pageId).map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => duplicateElement(selectedElement.id)}
              style={{ ...btnStyle, background: 'var(--bg-tertiary)' }}
            >
              复制线条
            </button>
            <button
              onClick={() => {
                if (confirm('确定删除此线条？')) {
                  deleteElement(selectedElement.id)
                }
              }}
              style={{ ...btnStyle, background: 'var(--danger-color)', color: '#fff' }}
            >
              删除线条
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selectedElement && selectedElement.type === 'red-box') {
    const style = selectedElement.style as Record<string, unknown>
    const btnStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, border: '1px solid var(--border-color)', cursor: 'pointer' }

    return (
      <div className="property-panel">
        <div className="panel-section">
          <h4>方框属性</h4>
          <div className="form-row">
            <div className="form-group">
              <label>边框颜色</label>
              <ColorPicker value={(style.borderColor as string) || '#ff0000'} onChange={(color) => updateElement(selectedElement.id, { style: { ...style, borderColor: color } })} />
            </div>
            <div className="form-group">
              <label>边框粗细</label>
              <input type="number" min={1} max={20} step={0.5} value={(style.borderWidth as number) || 3} onChange={(e) => updateElement(selectedElement.id, { style: { ...style, borderWidth: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="form-group">
            <label>填充颜色</label>
            <ColorPicker value={(style.fill as string) || 'transparent'} onChange={(color) => updateElement(selectedElement.id, { style: { ...style, fill: color } })} />
          </div>
          <div className="form-group">
            <label>所属页面</label>
            <select
              value={selectedElement.pageId}
              onChange={(e) => updateElement(selectedElement.id, { pageId: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>复制到其他页面相同位置</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  copyElementToPage(selectedElement.id, e.target.value)
                  e.target.value = ''
                }
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              <option value="">选择页面...</option>
              {pages.filter(p => p.id !== selectedElement.pageId).map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => duplicateElement(selectedElement.id)}
              style={{ ...btnStyle, background: 'var(--bg-tertiary)' }}
            >
              复制方框
            </button>
            <button
              onClick={() => {
                if (confirm('确定删除此方框？')) {
                  deleteElement(selectedElement.id)
                }
              }}
              style={{ ...btnStyle, background: 'var(--danger-color)', color: '#fff' }}
            >
              删除方框
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selectedElement && selectedElement.type === 'image') {
    const btnStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }
    const content = selectedElement.content as Record<string, unknown>
    const style = selectedElement.style as Record<string, unknown>
    const w = selectedElement.size.width
    const h = selectedElement.size.height
    const px = selectedElement.position.x
    const py = selectedElement.position.y
    const opacity = (style.opacity as number) ?? 1
    const ratio = h > 0 ? w / h : 1

    const handleWidthChange = (newW: number) => {
      if (lockImageRatio && h > 0) {
        updateElement(selectedElement.id, { size: { width: newW, height: Math.round(newW / ratio) } })
      } else {
        updateElement(selectedElement.id, { size: { width: newW, height: h } })
      }
    }

    const handleHeightChange = (newH: number) => {
      if (lockImageRatio && w > 0) {
        updateElement(selectedElement.id, { size: { width: Math.round(newH * ratio), height: newH } })
      } else {
        updateElement(selectedElement.id, { size: { width: w, height: newH } })
      }
    }

    return (
      <div className="property-panel">
        <div className="panel-section">
          <h4>图片属性</h4>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>图片源</label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', padding: '4px 6px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', maxHeight: 40, overflow: 'hidden' }}>
              {(content.src as string) || '(空)'}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>宽度 (mm)</label>
              <input type="number" min={10} max={2000} step={0.1} value={Math.round(w * 10) / 10} onChange={(e) => handleWidthChange(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>高度 (mm)</label>
              <input type="number" min={10} max={2000} step={0.1} value={Math.round(h * 10) / 10} onChange={(e) => handleHeightChange(Number(e.target.value))} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={lockImageRatio} onChange={(e) => setLockImageRatio(e.target.checked)} />
              锁定宽高比
            </label>
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-group">
              <label>位置 X (mm)</label>
              <input type="number" step={1} value={Math.round(px)} onChange={(e) => updateElement(selectedElement.id, { position: { x: Number(e.target.value), y: py } })} />
            </div>
            <div className="form-group">
              <label>位置 Y (mm)</label>
              <input type="number" step={1} value={Math.round(py)} onChange={(e) => updateElement(selectedElement.id, { position: { x: px, y: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>透明度</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => updateElement(selectedElement.id, { style: { ...style, opacity: Number(e.target.value) } })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{Math.round(opacity * 100)}%</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 12 }}>
            <button onClick={() => setCropDialogOpen(true)} style={{ ...btnStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Scissors size={14} />
              裁剪图片
            </button>
            <button onClick={() => duplicateElement(selectedElement.id)} style={{ ...btnStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Copy size={14} />
              复制图片
            </button>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>所属页面</label>
            <select
              value={selectedElement.pageId}
              onChange={(e) => updateElement(selectedElement.id, { pageId: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>复制到其他页面相同位置</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  copyElementToPage(selectedElement.id, e.target.value)
                  e.target.value = ''
                }
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              <option value="">选择页面...</option>
              {pages.filter(p => p.id !== selectedElement.pageId).map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('save-to-image-library'))
              }}
              style={{ ...btnStyle, background: 'var(--bg-tertiary)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}
            >
              <Database size={14} />
              保存到图片库
            </button>
            <button
              onClick={() => {
                if (confirm('确定删除此图片？')) {
                  deleteElement(selectedElement.id)
                }
              }}
              style={{ ...btnStyle, background: 'var(--danger-color)', color: '#fff', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Trash2 size={14} />
              删除图片
            </button>
          </div>
          <CropDialog
            isOpen={cropDialogOpen}
            src={(selectedElement.content as Record<string, unknown>).src as string}
            onClose={() => setCropDialogOpen(false)}
            onCrop={(croppedDataUrl) => {
              const img = new window.Image()
              img.onload = () => {
                updateElement(selectedElement.id, {
                  content: { src: croppedDataUrl },
                  size: { width: Math.round(img.width / PX_PER_MM * 10) / 10, height: Math.round(img.height / PX_PER_MM * 10) / 10 },
                })
              }
              img.src = croppedDataUrl
              setCropDialogOpen(false)
            }}
          />
        </div>
      </div>
    )
  }

  if (selectedCard) {
    const btnBase: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, lineHeight: '1.4', whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }

    return (
      <div className="property-panel">
        <div className="panel-section">
          <h4>卡片属性</h4>
          <div className="form-group">
            <label>标题</label>
            <ImeSafeInput value={selectedCard.title} onChange={(v) => updateCard(selectedCard.id, { title: v })} />
          </div>
          <div className="form-group">
            <label>名称</label>
            <ImeSafeInput value={selectedCard.name || ''} onChange={(v) => updateCard(selectedCard.id, { name: v })} />
          </div>
        </div>

        <div className="panel-section">
          <h4>常用操作{selectedCards.length > 0 ? <span style={{ color: 'var(--accent-color)', fontWeight: 400, marginLeft: 8 }}>已选 {selectedCards.length} 张</span> : null}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <button onClick={() => duplicateCard(selectedCard.id)} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Copy size={14} />
              复制卡片
            </button>
            <button onClick={() => {
              if (confirm('确定删除此卡片？')) {
                deleteCard(selectedCard.id)
              }
            }} style={{ ...btnBase, background: 'var(--danger-color)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Trash2 size={14} />
              删除卡片
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 4px', marginTop: 8 }}>
            <button onClick={() => copyCardStyle(selectedCard.id)} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ClipboardCopy size={14} />
              复制样式
            </button>
            <button onClick={() => {
              for (const c of batchTargets) pasteCardStyle(c.id)
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Copy size={14} />
              {selectedCards.length > 0 ? `粘贴样式(${selectedCards.length})` : '粘贴样式'}
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => applyStyleToAll(selectedCard.id)} style={{ ...btnBase, width: '100%', background: 'var(--accent-color)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Layers size={14} />
              把当前卡片样式应用到所有卡片
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8 }}>
            <button onClick={() => setStyleLibraryOpen(true)} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Palette size={14} />
              样式库
            </button>
            <button onClick={() => setContentLibraryOpen(true)} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <FolderOpen size={14} />
              资料库
            </button>
            <button onClick={() => setSizeLibraryOpen(true)} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ruler size={14} />
              尺寸库
            </button>
          </div>
        </div>

        <div className="panel-section">
          <h4>卡片尺寸 (mm)</h4>
          <div className="form-row">
            <div className="form-group">
              <label>宽度</label>
              <input type="number" value={selectedCard.size.projectWidth} onChange={(e) => {
                const v = Number(e.target.value)
                for (const c of batchTargets) updateCard(c.id, { size: { ...c.size, projectWidth: v } })
              }} />
            </div>
            <div className="form-group">
              <label>高度</label>
              <input type="number" value={selectedCard.size.projectHeight} onChange={(e) => {
                const v = Number(e.target.value)
                for (const c of batchTargets) updateCard(c.id, { size: { ...c.size, projectHeight: v } })
              }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 4px', marginTop: 8 }}>
            <button onClick={() => {
              const pageCards = cards.filter(c => c.pageId === selectedCard.pageId).sort((a, b) => a.order - b.order)
              const idx = pageCards.findIndex(c => c.id === selectedCard.id)
              if (idx > 0) {
                const prev = pageCards[idx - 1]
                updateCard(selectedCard.id, { size: { ...selectedCard.size, projectWidth: prev.size.projectWidth } })
              }
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Layers size={14} />
              复制上个卡片宽度
            </button>
            <button onClick={() => {
              const pageCards = cards.filter(c => c.pageId === selectedCard.pageId).sort((a, b) => a.order - b.order)
              const idx = pageCards.findIndex(c => c.id === selectedCard.id)
              if (idx > 0) {
                const prev = pageCards[idx - 1]
                updateCard(selectedCard.id, { size: { ...selectedCard.size, projectHeight: prev.size.projectHeight } })
              }
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Layers size={14} />
              复制上个卡片高度
            </button>
            <button onClick={() => {
              for (const c of batchTargets) {
                const computed = calcCardSize(c.title, c.content, c.style.bodyFontSize ?? 13, c.style.titleFontSize ?? 14, c.style.bodyLineHeight ?? 1.5, c.style.titlePaddingY ?? 4, c.style.paddingX ?? 10, undefined, c.style.titleHeight)
                const sa = getSafeArea(currentPage)
                updateCard(c.id, { size: { ...c.size, projectWidth: Math.min(computed.width, sa.width) } })
              }
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ruler size={14} />
              {selectedCards.length > 0 ? `自动宽度(${selectedCards.length})` : '自动宽度'}
            </button>
            <button onClick={() => {
              for (const c of batchTargets) {
                const ch = calcCardHeight(c.title, c.content, c.size.projectWidth, c.style.bodyFontSize ?? 13, c.style.titleFontSize ?? 14, c.style.bodyLineHeight ?? 1.5, c.style.paddingX ?? 10, c.style.titlePaddingY ?? 4, c.flags.showNumber, 0, c.flags.hideBodyArea, c.style.titleHeight)
                updateCard(c.id, { size: { ...c.size, projectHeight: ch } })
              }
            }} style={{ ...btnBase, background: 'var(--accent-color)', color: '#fff', borderColor: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ruler size={14} />
              {selectedCards.length > 0 ? `自动高度(${selectedCards.length})` : '自动高度'}
            </button>
            <button onClick={() => {
              const otherCards = cards.filter(c => c.id !== selectedCard.id)
              for (const c of otherCards) {
                updateCard(c.id, { size: { ...c.size, projectWidth: selectedCard.size.projectWidth } })
              }
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ArrowUpRight size={14} />
              宽度应用到所有
            </button>
            <button onClick={() => {
              const otherCards = cards.filter(c => c.id !== selectedCard.id)
              for (const c of otherCards) {
                updateCard(c.id, { size: { ...c.size, projectHeight: selectedCard.size.projectHeight } })
              }
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ArrowDownRight size={14} />
              高度应用到所有
            </button>
            <button onClick={() => { clipboardWidth = selectedCard.size.projectWidth }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ClipboardCopy size={14} />
              复制宽度
            </button>
            <button onClick={() => {
              if (clipboardWidth != null) {
                for (const c of batchTargets) {
                  updateCard(c.id, { size: { ...c.size, projectWidth: clipboardWidth } })
                }
              }
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Copy size={14} />
              {selectedCards.length > 0 ? `粘贴宽度(${selectedCards.length})` : '粘贴宽度'}
            </button>
            <button onClick={() => { clipboardHeight = selectedCard.size.projectHeight }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ClipboardCopy size={14} />
              复制高度
            </button>
            <button onClick={() => {
              if (clipboardHeight != null) {
                for (const c of batchTargets) {
                  updateCard(c.id, { size: { ...c.size, projectHeight: clipboardHeight } })
                }
              }
            }} style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Copy size={14} />
              {selectedCards.length > 0 ? `粘贴高度(${selectedCards.length})` : '粘贴高度'}
            </button>
          </div>
        </div>

        <div className="panel-section">
          <h4>标题样式</h4>
          <div className="form-row">
            <div className="form-group">
              <label>字体</label>
              <select value={selectedCard.style.titleFont} onChange={(e) => {
                const v = e.target.value
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleFont: v } })
              }}>
                {ALLOWED_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>字号</label>
              <input type="number" min={8} max={72} step={1} value={selectedCard.style.titleFontSize ?? 14}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleFontSize: v } })
                }} />
            </div>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.style.titleBold} onChange={(e) => {
                const v = e.target.checked
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleBold: v } })
              }} />
              {' '}加粗
            </label>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>标题颜色</label>
              <ColorPicker value={selectedCard.style.titleColor} onChange={(color) => {
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleColor: color } })
              }} />
            </div>
            <div className="form-group">
              <label>标题背景</label>
              <ColorPicker value={selectedCard.style.titleBackgroundColor} onChange={(color) => {
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleBackgroundColor: color } })
              }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>标题上下边距</label>
              <input type="number" min={0} max={30} step={1} value={selectedCard.style.titlePaddingY ?? 4}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titlePaddingY: v } })
                }} />
            </div>
            <div className="form-group">
              <label>编号与标题间隔</label>
              <input type="number" min={0} max={50} step={1}
                value={selectedCard.style.titleNumberGap ?? 1}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleNumberGap: v } })
                }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>标题高度</label>
              <input type="number" min={0} max={100} step={1} placeholder="自动"
                value={selectedCard.style.titleHeight ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? undefined : Number(e.target.value)
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleHeight: v } })
                }} />
            </div>
            <div className="form-group">
              <label>编号风格</label>
              <select value={selectedCard.style.titleNumberStyle ?? 'number-dot'}
                onChange={(e) => {
                  const v = e.target.value as 'number' | 'number-dot' | 'number-hash' | 'number-hash-prefix' | 'number-dash' | 'number-space'
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, titleNumberStyle: v } })
                }}>
                <option value="number">纯数字</option>
                <option value="number-dot">数字加符号"."</option>
                <option value="number-hash">数字加符号"# "</option>
                <option value="number-hash-prefix">符号# 加数字</option>
                <option value="number-dash">数字加符号"-"</option>
                <option value="number-space">数字加空格</option>
              </select>
            </div>
          </div>
        </div>

        <div className="panel-section">
          <h4>正文样式</h4>
          <div className="form-row">
            <div className="form-group">
              <label>字体</label>
              <select value={selectedCard.style.bodyFont} onChange={(e) => {
                const v = e.target.value
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, bodyFont: v } })
              }}>
                {ALLOWED_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>字号</label>
              <input type="number" min={8} max={72} step={1} value={selectedCard.style.bodyFontSize ?? 13}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, bodyFontSize: v } })
                }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>行间距</label>
              <input type="number" min={0.8} max={3.0} step={0.1} value={selectedCard.style.bodyLineHeight ?? 1.5}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, bodyLineHeight: v } })
                }} />
            </div>
            <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>正文颜色</label>
                <ColorPicker value={selectedCard.style.bodyColor} onChange={(color) => {
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, bodyColor: color } })
                }} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>正文背景</label>
                <ColorPicker value={selectedCard.style.bodyBackgroundColor} onChange={(color) => {
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, bodyBackgroundColor: color } })
                }} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel-section">
          <h4>边框样式</h4>
          <div className="form-row">
            <div className="form-group">
              <label>边框粗细</label>
              <input type="number" min={0} max={10} step={0.5} value={selectedCard.style.borderWidth} onChange={(e) => {
                const v = Number(e.target.value)
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, borderWidth: v } })
              }} />
            </div>
            <div className="form-group">
              <label>边框颜色</label>
              <ColorPicker value={selectedCard.style.borderColor} onChange={(color) => {
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, borderColor: color } })
              }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>边框圆角</label>
              <input type="number" min={0} max={30} step={1} value={selectedCard.style.borderRadius ?? 4} onChange={(e) => {
                const v = Number(e.target.value)
                for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, borderRadius: v } })
              }} />
            </div>
            <div className="form-group">
              <label>内容左右边距</label>
              <input type="number" min={0} max={50} step={1} value={selectedCard.style.paddingX ?? 10}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  for (const c of batchTargets) updateCard(c.id, { style: { ...c.style, paddingX: v } })
                }} />
            </div>
          </div>
        </div>

        <div className="panel-section">
          <h4>显示选项</h4>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.hideTitle} onChange={(e) => {
                const v = e.target.checked
                for (const c of batchTargets) updateCard(c.id, { flags: { ...c.flags, hideTitle: v } })
              }} />
              {' '}隐藏标题
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.showNumber} onChange={(e) => {
                const v = e.target.checked
                for (const c of batchTargets) updateCard(c.id, { flags: { ...c.flags, showNumber: v } })
              }} />
              {' '}显示编号
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.hideTitleText} onChange={(e) => {
                const v = e.target.checked
                for (const c of batchTargets) updateCard(c.id, { flags: { ...c.flags, hideTitleText: v } })
              }} />
              {' '}隐藏标题文字
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.hideBody} onChange={(e) => {
                const v = e.target.checked
                for (const c of batchTargets) updateCard(c.id, { flags: { ...c.flags, hideBody: v } })
              }} />
              {' '}隐藏正文文字
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.hideBodyArea} onChange={(e) => {
                const v = e.target.checked
                for (const c of batchTargets) {
                  const ch = calcCardHeight(c.title, c.content, c.size.projectWidth, c.style.bodyFontSize ?? 13, c.style.titleFontSize ?? 14, c.style.bodyLineHeight ?? 1.5, c.style.paddingX ?? 10, c.style.titlePaddingY ?? 4, c.flags.showNumber, 0, v, c.style.titleHeight)
                  updateCard(c.id, { flags: { ...c.flags, hideBodyArea: v }, size: { ...c.size, projectHeight: ch } })
                }
              }} />
              {' '}隐藏正文区域
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.hideBorder} onChange={(e) => {
                const v = e.target.checked
                for (const c of batchTargets) updateCard(c.id, { flags: { ...c.flags, hideBorder: v } })
              }} />
              {' '}隐藏边框
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.excludeFromLayout} onChange={(e) => updateCard(selectedCard.id, { flags: { ...selectedCard.flags, excludeFromLayout: e.target.checked } })} />
              {' '}排除自动排版
            </label>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={selectedCard.flags.excludeFromNumbering} onChange={(e) => updateCard(selectedCard.id, { flags: { ...selectedCard.flags, excludeFromNumbering: e.target.checked } })} />
              {' '}排除编号
            </label>
          </div>
        </div>
        <StyleLibraryDialog
          isOpen={styleLibraryOpen}
          onClose={() => setStyleLibraryOpen(false)}
          onApply={(style) => {
            for (const c of batchTargets) updateCard(c.id, { style })
          }}
          currentStyle={selectedCard.style}
        />
        <ContentLibraryDialog
          isOpen={contentLibraryOpen}
          onClose={() => setContentLibraryOpen(false)}
          onApply={(title, content, name) => updateCard(selectedCard.id, { title, content, name })}
          currentTitle={selectedCard.title}
          currentContent={selectedCard.content}
          currentName={selectedCard.name}
          onBatchCreateCards={(items) => {
            if (currentProjectId && currentPageId) {
              const afterId = selectedCardIds.length > 0 ? selectedCardIds[0] : undefined
              createCardsFromPresets(currentProjectId, currentPageId, items, afterId)
            }
          }}
        />
        <SizeLibraryDialog
          isOpen={sizeLibraryOpen}
          onClose={() => setSizeLibraryOpen(false)}
          onApply={(width, height) => {
            for (const c of batchTargets) updateCard(c.id, { size: { ...c.size, projectWidth: width, projectHeight: height } })
          }}
          currentWidth={selectedCard.size.projectWidth}
          currentHeight={selectedCard.size.projectHeight}
        />
      </div>
    )
  }

  if (selectedElement && selectedElement.type === 'text') {
    const content = selectedElement.content as Record<string, unknown>
    const btnStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, border: '1px solid var(--border-color)', cursor: 'pointer' }

    return (
      <div className="property-panel">
        <div className="panel-section">
          <h4>文本元素</h4>
          <div className="form-group">
            <label>文本内容</label>
            <ImeSafeInput value={(content.text as string) || ''} onChange={(v) => updateElement(selectedElement.id, { content: { ...content, text: v } })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>字号</label>
              <input type="number" min={8} max={200} value={(content.fontSize as number) || 16} onChange={(e) => updateElement(selectedElement.id, { content: { ...content, fontSize: Number(e.target.value) } })} />
            </div>
            <div className="form-group">
              <label>字体</label>
              <select value={(content.fontFamily as string) || 'Arial'} onChange={(e) => updateElement(selectedElement.id, { content: { ...content, fontFamily: e.target.value } })}>
                {ALLOWED_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>颜色</label>
              <ColorPicker value={(content.color as string) || '#000000'} onChange={(color) => updateElement(selectedElement.id, { content: { ...content, color } })} />
            </div>
            <div className="form-group">
              <label>加粗</label>
              <input type="checkbox" checked={(content.bold as boolean) || false} onChange={(e) => updateElement(selectedElement.id, { content: { ...content, bold: e.target.checked } })} style={{ marginTop: 8 }} />
            </div>
          </div>
          <div className="form-group">
            <label>对齐方式</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {(['left', 'center', 'right'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => updateElement(selectedElement.id, { content: { ...content, align: a } })}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    background: (content.align as string || 'left') === a ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: (content.align as string || 'left') === a ? '#fff' : 'var(--text-primary)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {a === 'left' ? '左对齐' : a === 'center' ? '居中' : '右对齐'}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>所属页面</label>
            <select
              value={selectedElement.pageId}
              onChange={(e) => updateElement(selectedElement.id, { pageId: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>复制到其他页面相同位置</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  copyElementToPage(selectedElement.id, e.target.value)
                  e.target.value = ''
                }
              }}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            >
              <option value="">选择页面...</option>
              {pages.filter(p => p.id !== selectedElement.pageId).map(p => (
                <option key={p.id} value={p.id}>{p.name || `页面 ${p.order + 1}`}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => duplicateElement(selectedElement.id)}
              style={{ ...btnStyle, background: 'var(--bg-tertiary)' }}
            >
              复制元素
            </button>
            <button
              onClick={() => {
                if (confirm('确定删除此元素？')) {
                  deleteElement(selectedElement.id)
                }
              }}
              style={{ ...btnStyle, background: 'var(--danger-color)', color: '#fff' }}
            >
              删除元素
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="property-panel">
      <div className="panel-section">
        <h4>页面设置</h4>
        <div style={{ fontSize: 11, color: 'var(--accent-color)', marginBottom: 8 }}>{pageSettingsHint}</div>
        <div className="form-group">
          <label>页面规格</label>
          <select value={currentPage.size} onChange={(e) => updatePageSettings({ size: e.target.value as 'A4' | 'A3' })}>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
        </div>
        <div className="form-group">
          <label>方向</label>
          <select value={currentPage.orientation} onChange={(e) => updatePageSettings({ orientation: e.target.value as 'portrait' | 'landscape' })}>
            <option value="portrait">纵向</option>
            <option value="landscape">横向</option>
          </select>
        </div>
        <h4 style={{ marginTop: 12 }}>页面边距 (mm)</h4>
        <div className="form-row">
          <div className="form-group">
            <label>上</label>
            <input type="number" value={currentPage.margins.top} onChange={(e) => updatePageSettings({ margins: { ...currentPage.margins, top: Number(e.target.value) } })} />
          </div>
          <div className="form-group">
            <label>下</label>
            <input type="number" value={currentPage.margins.bottom} onChange={(e) => updatePageSettings({ margins: { ...currentPage.margins, bottom: Number(e.target.value) } })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>左</label>
            <input type="number" value={currentPage.margins.left} onChange={(e) => updatePageSettings({ margins: { ...currentPage.margins, left: Number(e.target.value) } })} />
          </div>
          <div className="form-group">
            <label>右</label>
            <input type="number" value={currentPage.margins.right} onChange={(e) => updatePageSettings({ margins: { ...currentPage.margins, right: Number(e.target.value) } })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>最小左右间距 (mm)</label>
            <input type="number" min={0} value={currentPage.cardMinHSpacing} onChange={(e) => updatePageSettings({ cardMinHSpacing: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>最小上下间距 (mm)</label>
            <input type="number" min={0} value={currentPage.cardMinVSpacing} onChange={(e) => updatePageSettings({ cardMinVSpacing: Number(e.target.value) })} />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label>页面背景色</label>
          <ColorPicker value={currentPage.backgroundColor || '#ffffff'} onChange={(color) => updatePageSettings({ backgroundColor: color })} />
        </div>
      </div>

      <div className="panel-section">
        <h4>页码设置</h4>
        <div className="form-group">
          <label>
            <input type="checkbox" checked={currentPage.pageNumber.enabled} onChange={(e) => updatePageSettings({ pageNumber: { ...currentPage.pageNumber, enabled: e.target.checked } })} />
            {' '}显示页码
          </label>
        </div>
        {currentPage.pageNumber.enabled && (
          <>
            <div className="form-group">
              <label>位置</label>
              <select value={currentPage.pageNumber.position} onChange={(e) => updatePageSettings({ pageNumber: { ...currentPage.pageNumber, position: e.target.value as PageNumberSettings['position'] } })}>
                <option value="top-left">左上</option>
                <option value="top-center">中上</option>
                <option value="top-right">右上</option>
                <option value="bottom-left">左下</option>
                <option value="bottom-center">中下</option>
                <option value="bottom-right">右下</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>字号</label>
                <input type="number" min={6} max={48} value={currentPage.pageNumber.size} onChange={(e) => updatePageSettings({ pageNumber: { ...currentPage.pageNumber, size: Number(e.target.value) } })} />
              </div>
              <div className="form-group">
                <label>字体</label>
                <select value={currentPage.pageNumber.font} onChange={(e) => updatePageSettings({ pageNumber: { ...currentPage.pageNumber, font: e.target.value } })}>
                  {ALLOWED_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>颜色</label>
              <ColorPicker value={currentPage.pageNumber.color} onChange={(color) => updatePageSettings({ pageNumber: { ...currentPage.pageNumber, color } })} />
            </div>
          </>
        )}
      </div>

      <div className="panel-section">
        <h4>页脚设置</h4>
        <div className="form-group">
          <label>
            <input type="checkbox" checked={currentPage.footer.enabled} onChange={(e) => updatePageSettings({ footer: { ...currentPage.footer, enabled: e.target.checked } })} />
            {' '}显示页脚
          </label>
        </div>
        {currentPage.footer.enabled && (
          <>
            <div className="form-group">
              <label>页脚文本</label>
              <textarea value={currentPage.footer.text} onChange={(e) => updatePageSettings({ footer: { ...currentPage.footer, text: e.target.value } })} rows={3} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div className="form-group">
              <label>位置</label>
              <select value={currentPage.footer.position} onChange={(e) => updatePageSettings({ footer: { ...currentPage.footer, position: e.target.value as 'left' | 'center' | 'right' } })}>
                <option value="left">左对齐</option>
                <option value="center">居中</option>
                <option value="right">右对齐</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>字号</label>
                <input type="number" min={6} max={36} value={currentPage.footer.size} onChange={(e) => updatePageSettings({ footer: { ...currentPage.footer, size: Number(e.target.value) } })} />
              </div>
              <div className="form-group">
                <label>字体</label>
                <select value={currentPage.footer.font} onChange={(e) => updatePageSettings({ footer: { ...currentPage.footer, font: e.target.value } })}>
                  {ALLOWED_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>颜色</label>
              <ColorPicker value={currentPage.footer.color} onChange={(color) => updatePageSettings({ footer: { ...currentPage.footer, color } })} />
            </div>
          </>
        )}
      </div>

      <div className="panel-section">
        <h4>水印设置</h4>
        <div className="form-group">
          <label>
            <input type="checkbox" checked={currentPage.watermark.enabled} onChange={(e) => updatePageSettings({ watermark: { ...currentPage.watermark, enabled: e.target.checked } })} />
            {' '}启用水印
          </label>
        </div>
        {currentPage.watermark.enabled && (
          <>
            <div className="form-group">
              <label>水印文本</label>
              <ImeSafeInput value={currentPage.watermark.text} onChange={(v) => updatePageSettings({ watermark: { ...currentPage.watermark, text: v } })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>字号</label>
                <input type="number" value={currentPage.watermark.fontSize} onChange={(e) => updatePageSettings({ watermark: { ...currentPage.watermark, fontSize: Number(e.target.value) } })} />
              </div>
              <div className="form-group">
                <label>透明度</label>
                <input type="number" min={0} max={1} step={0.05} value={currentPage.watermark.opacity} onChange={(e) => updatePageSettings({ watermark: { ...currentPage.watermark, opacity: Number(e.target.value) } })} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
