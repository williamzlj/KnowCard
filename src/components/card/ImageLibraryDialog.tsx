import { useEffect, useState, useRef } from 'react'
import { useImageLibraryStore } from '../../stores/useImageLibraryStore'
import { PinIcon, PinOffIcon } from '../icons/PinIcon'
import { ImageIcon, Upload, Trash2, Copy, Search, X, ClipboardPaste } from 'lucide-react'

interface ImageLibraryDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (dataUrl: string) => void
}

export function ImageLibraryDialog({ isOpen, onClose, onSelect }: ImageLibraryDialogProps) {
  const { items, loadItems, addItems, deleteItem, togglePin } = useImageLibraryStore()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [keywordMap, setKeywordMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) loadItems()
  }, [isOpen, loadItems])

  useEffect(() => {
    const nm: Record<string, string> = {}
    const km: Record<string, string> = {}
    for (const item of items) {
      nm[item.id] = item.name
      km[item.id] = item.keywords
    }
    setNameMap(prev => ({ ...prev, ...nm }))
    setKeywordMap(prev => ({ ...prev, ...km }))
  }, [items])

  const filteredItems = items.filter(item => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.keywords.toLowerCase().includes(q)
  })

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const readers = Array.from(files).map(file => new Promise<{ name: string; keywords: string; dataUrl: string }>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ name: file.name.replace(/\.[^.]+$/, ''), keywords: '', dataUrl: reader.result as string })
      reader.readAsDataURL(file)
    }))

    Promise.all(readers).then(results => {
      addItems(results)
    })

    e.target.value = ''
  }

  const handleCopyToClipboard = async (dataUrl: string) => {
    try {
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {
      alert('复制失败，请尝试在图片上右键复制')
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      const results: { name: string; keywords: string; dataUrl: string }[] = []
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(blob)
            })
            const ext = type.split('/')[1] || 'png'
            results.push({ name: `剪贴板_${Date.now()}`, keywords: '', dataUrl })
            break
          }
        }
      }
      if (results.length === 0) {
        alert('剪贴板中没有图片')
        return
      }
      addItems(results)
    } catch {
      alert('读取剪贴板失败，请确认已授予剪贴板权限')
    }
  }

  const handleSelectImage = async (dataUrl: string) => {
    if (onSelect) {
      await onSelect(dataUrl)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '95%', maxWidth: 1100, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>图片库</h3>
          <button onClick={onClose} style={{ fontSize: 20, padding: '0 8px' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索图片名称或关键词..."
              style={{ width: '100%', padding: '8px 36px 8px 32px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 14 }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                title="清除搜索"
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-muted)', zIndex: 1 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
          >
            <Upload size={16} />
            批量上传
          </button>
          <button
            onClick={handlePasteFromClipboard}
            title="从剪贴板导入图片"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
          >
            <ClipboardPaste size={16} />
            从剪贴板导入
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                if (confirm(`确定删除选中的 ${selectedIds.size} 张图片？`)) {
                  for (const id of selectedIds) deleteItem(id)
                  setSelectedIds(new Set())
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--danger-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
            >
              <Trash2 size={16} />
              删除选中
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 60 }}>
              <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>{search ? '没有找到匹配的图片' : '图片库为空，点击"批量上传"添加图片'}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    const next = new Set(selectedIds)
                    if (next.has(item.id)) next.delete(item.id)
                    else next.add(item.id)
                    setSelectedIds(next)
                  }}
                  style={{
                    border: selectedIds.has(item.id) ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 8,
                    cursor: 'pointer',
                    background: selectedIds.has(item.id) ? 'var(--accent-light, #e8f4fd)' : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      paddingBottom: '75%',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 4,
                      background: '#f5f5f5',
                      marginBottom: 8,
                    }}
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(item.id) }}
                      title={item.pinned ? '取消置顶' : '置顶'}
                      style={{ padding: 2, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                      {item.pinned ? <PinIcon size={14} color="#999" /> : <PinOffIcon size={14} color="#ccc" />}
                    </button>
                    <input
                      type="text"
                      value={nameMap[item.id] ?? item.name}
                      onChange={(e) => {
                        setNameMap(prev => ({ ...prev, [item.id]: e.target.value }))
                      }}
                      onBlur={(e) => {
                        useImageLibraryStore.getState().updateItem(item.id, { name: e.target.value })
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="图片名称"
                      style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}
                    />
                  </div>
                  <input
                    type="text"
                    value={keywordMap[item.id] ?? item.keywords}
                    onChange={(e) => {
                      setKeywordMap(prev => ({ ...prev, [item.id]: e.target.value }))
                    }}
                    onBlur={(e) => {
                      useImageLibraryStore.getState().updateItem(item.id, { keywords: e.target.value })
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="关键词（用空格分隔）"
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}
                  />

                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectImage(item.dataUrl)
                      }}
                      title="插入到画布"
                      style={{ flex: 1, padding: '4px 12px', fontSize: 12, border: '1px solid var(--accent-color)', borderRadius: 4, background: 'var(--accent-color)', color: '#fff', cursor: 'pointer' }}
                    >
                      插入
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyToClipboard(item.dataUrl)
                      }}
                      title="复制到剪贴板"
                      style={{ flex: 1, padding: '4px 12px', fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('确定删除此图片？')) deleteItem(item.id)
                      }}
                      title="删除"
                      style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--danger-color)', borderRadius: 4, background: 'transparent', color: 'var(--danger-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
