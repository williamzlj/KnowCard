import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { db, type CardStylePreset } from '../../db/database'
import type { CardStyle } from '../../types/card'
import { PinIcon, PinOffIcon } from '../icons/PinIcon'

interface Props {
  isOpen: boolean
  onClose: () => void
  onApply: (style: CardStyle) => void
  currentStyle: CardStyle
}

function sortPresets(presets: CardStylePreset[]): CardStylePreset[] {
  return [...presets].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.createdAt - a.createdAt
  })
}

export function StyleLibraryDialog({ isOpen, onClose, onApply, currentStyle }: Props) {
  const [presets, setPresets] = useState<CardStylePreset[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadPresets()
    }
  }, [isOpen])

  const loadPresets = async () => {
    const all = await db.stylePresets.toArray()
    setPresets(sortPresets(all))
  }

  const handleSave = async () => {
    const name = newName.trim()
    if (!name) return
    await db.stylePresets.add({
      id: uuid(),
      name,
      style: JSON.stringify(currentStyle),
      createdAt: Date.now(),
    })
    setNewName('')
    await loadPresets()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此样式？')) return
    await db.stylePresets.delete(id)
    await loadPresets()
  }

  const handleTogglePin = async (preset: CardStylePreset) => {
    await db.stylePresets.update(preset.id, { pinned: !preset.pinned })
    await loadPresets()
  }

  const handleApply = (preset: CardStylePreset) => {
    const style = JSON.parse(preset.style) as CardStyle
    onApply(style)
    onClose()
  }

  const startRename = (preset: CardStylePreset) => {
    setEditingId(preset.id)
    setEditName(preset.name)
  }

  const handleRename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    await db.stylePresets.update(id, { name })
    setEditingId(null)
    setEditName('')
    await loadPresets()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '560px', maxWidth: '90%' }}>
        <div className="modal-header">
          <h3>卡片样式库</h3>
          <button onClick={onClose} style={{ fontSize: 20, padding: '0 8px' }}>×</button>
        </div>
        <div style={{ padding: '16px 48px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              placeholder="输入样式名称…"
              style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}
            />
            <button className="btn-primary" onClick={handleSave} disabled={!newName.trim()} style={{ whiteSpace: 'nowrap' }}>保存当前样式</button>
          </div>
        </div>
        <div style={{ padding: '12px 48px', maxHeight: 360, overflowY: 'auto' }}>
          {presets.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 13 }}>暂无保存的样式</div>
          )}
          {presets.map(p => {
            let style: CardStyle | null = null
            try { style = JSON.parse(p.style) } catch { return null }
            if (!style) return null
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => handleTogglePin(p)}
                  title={p.pinned ? '取消置顶' : '置顶'}
                  style={{ padding: '2px 4px', fontSize: 14, border: 'none', borderRadius: 3, background: 'transparent', color: p.pinned ? '#e74c3c' : '#999', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
                >
                  {p.pinned ? <PinIcon size={14} color="#e74c3c" /> : <PinOffIcon size={14} color="#999" />}
                </button>
                <div style={{ width: 40, height: 30, borderRadius: 4, border: `2px solid ${style.borderColor}`, background: style.bodyBackgroundColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === p.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') setEditingId(null) }}
                      onBlur={() => handleRename(p.id)}
                      autoFocus
                      style={{ width: '100%', padding: '2px 4px', border: '1px solid var(--accent-color)', borderRadius: 2, fontSize: 13 }}
                    />
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }} onDoubleClick={() => startRename(p)} title="双击重命名">{p.name}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
                <button onClick={() => handleApply(p)} style={{ padding: '4px 8px', fontSize: 11, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer' }}>应用</button>
                <button onClick={() => handleDelete(p.id)} style={{ padding: '4px 8px', fontSize: 11, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--danger-color)', color: '#fff', cursor: 'pointer' }}>删除</button>
              </div>
            )
          })}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
