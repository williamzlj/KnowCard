import { useState, useEffect } from 'react'
import { X, Bookmark, Trash2, Edit, Check, Plus } from 'lucide-react'
import { PinIcon, PinOffIcon } from '../icons/PinIcon'
import { useRegexLibraryStore } from '../../stores/useRegexLibraryStore'

interface Props {
  isOpen: boolean
  onClose: () => void
  onLoad: (pattern: string, replace: string) => void
  currentPattern: string
  currentReplace: string
}

export function RegexLibraryDialog({ isOpen, onClose, onLoad, currentPattern, currentReplace }: Props) {
  const { items, loadItems, addItem, updateItem, deleteItem, togglePin } = useRegexLibraryStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPattern, setEditPattern] = useState('')
  const [editReplace, setEditReplace] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')

  useEffect(() => {
    if (isOpen) loadItems()
  }, [isOpen, loadItems])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!saveName.trim()) return
    await addItem({
      name: saveName.trim(),
      description: saveDesc.trim(),
      pattern: currentPattern,
      replace: currentReplace,
    })
    setSaveName('')
    setSaveDesc('')
    setShowSaveForm(false)
  }

  const handleStartEdit = (item: typeof items[0]) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditDesc(item.description)
    setEditPattern(item.pattern)
    setEditReplace(item.replace)
  }

  const handleSaveEdit = async (id: string) => {
    await updateItem(id, {
      name: editName.trim(),
      description: editDesc.trim(),
      pattern: editPattern,
      replace: editReplace,
    })
    setEditingId(null)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '95%', maxWidth: 1100, display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>正则表达式资料库</h3>
          <button onClick={onClose} style={{ fontSize: 20, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowSaveForm(!showSaveForm)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--text-color)' }}
          >
            <Bookmark size={14} />
            保存当前正则
          </button>
        </div>

        {showSaveForm && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="规则名称"
              style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13 }}
            />
            <input
              value={saveDesc}
              onChange={(e) => setSaveDesc(e.target.value)}
              placeholder="说明（可选）"
              style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13 }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              查找：{currentPattern || '(空)'} → 替换：{currentReplace || '(空)'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                style={{ padding: '6px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: saveName.trim() ? 'var(--accent-color)' : 'var(--bg-tertiary)', color: saveName.trim() ? '#fff' : 'var(--text-muted)', cursor: saveName.trim() ? 'pointer' : 'default' }}
              >
                保存
              </button>
              <button
                onClick={() => setShowSaveForm(false)}
                style={{ padding: '6px 16px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: 16, flex: 1, overflowY: 'auto', maxHeight: 500 }}>
          {items.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 13 }}>
              暂无保存的正则表达式
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {items.map(item => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 10,
                  background: '#fff',
                }}
              >
                {editingId === item.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="名称"
                      style={{ padding: '4px 6px', border: '1px solid var(--accent-color)', borderRadius: 4, fontSize: 13 }}
                    />
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="说明（可选）"
                      style={{ padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13 }}
                    />
                    <input
                      value={editPattern}
                      onChange={(e) => setEditPattern(e.target.value)}
                      placeholder="正则查找"
                      style={{ padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}
                    />
                    <input
                      value={editReplace}
                      onChange={(e) => setEditReplace(e.target.value)}
                      placeholder="替换为"
                      style={{ padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, fontFamily: 'monospace' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleSaveEdit(item.id)} style={{ flex: 1, padding: '5px 10px', fontSize: 12, border: 'none', borderRadius: 4, background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Check size={14} />保存
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '5px 10px', fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <X size={14} />取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(item.id) }}
                        title={item.pinned ? '取消置顶' : '置顶'}
                        style={{ padding: 2, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        {item.pinned ? <PinIcon size={14} color="#999" /> : <PinOffIcon size={14} color="#ccc" />}
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.description}</div>
                    )}
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', marginBottom: 8, background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: 4, lineHeight: 1.6 }}>
                      <div>查找：<code style={{ fontSize: 11 }}>{item.pattern || '(空)'}</code></div>
                      <div>替换：<code style={{ fontSize: 11 }}>{item.replace || '(空)'}</code></div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => onLoad(item.pattern, item.replace)} title="加载" className="content-card-action-btn" style={{ flex: '0.5' }}>
                        <Plus size={14} />
                      </button>
                      <button onClick={() => handleStartEdit(item)} title="编辑" className="content-card-action-btn" style={{ flex: '0.3' }}>
                        <Edit size={14} />
                      </button>
                      <button onClick={() => { if (confirm('确定删除？')) deleteItem(item.id) }} title="删除" className="content-card-action-btn" style={{ flex: '0.3', minWidth: 28 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ gap: 8 }}>
          <button className="btn-cancel" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
