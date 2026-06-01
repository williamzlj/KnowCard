import { useState, useEffect, useMemo, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { db, type CardContentPreset } from '../../db/database'
import { PinIcon, PinOffIcon } from '../icons/PinIcon'
import {
  X,
  Plus,
  Edit,
  Trash2,
  Check,
  Upload,
  Download,
  Search,
  ClipboardCopy
} from 'lucide-react'

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  
  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          {text}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '6px solid transparent',
            borderTopColor: 'rgba(0, 0, 0, 0.8)',
          }} />
        </div>
      )}
    </div>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onApply: (title: string, content: Record<string, unknown>, name: string) => void
  currentTitle: string
  currentContent: Record<string, unknown>
  currentName?: string
  onBatchCreateCards?: (items: Array<{ title: string; content: Record<string, unknown>; name?: string }>) => void
  standalone?: boolean
}

function sortPresets(presets: CardContentPreset[]): CardContentPreset[] {
  return [...presets].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.createdAt - a.createdAt
  })
}

function extractPreview(content: Record<string, unknown>): string {
  if (!content || !content.content) return ''
  const texts: string[] = []
  const walk = (nodes: unknown[]) => {
    for (const node of nodes as Array<Record<string, unknown>>) {
      if (node.text) texts.push(node.text as string)
      if (node.content) walk(node.content as unknown[])
    }
  }
  walk(content.content as unknown[])
  return texts.join(' ').slice(0, 100)
}

function contentToText(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson) as Record<string, unknown>
    if (!parsed || !parsed.content) return ''
    const texts: string[] = []
    const walk = (nodes: unknown[]) => {
      for (const node of nodes as Array<Record<string, unknown>>) {
        if (node.text) texts.push(node.text as string)
        if (node.content) walk(node.content as unknown[])
      }
    }
    walk(parsed.content as unknown[])
    return texts.join('\n')
  } catch {
    return ''
  }
}

function tiptapToHtml(content: Record<string, unknown>): string {
  const nodes = (content.content as Array<Record<string, unknown>>) || []
  return nodes.map(n => nodeToHtml(n, false)).join('')
}

function processInlineContent(contentNodes: unknown[]): string {
  if (!contentNodes) return ''
  return (contentNodes as Array<Record<string, unknown>>).map(n => {
    if (n.type === 'text') {
      let text = escapeHtml((n.text as string) || '')
      const marks = (n.marks as Array<Record<string, unknown>>) || []
      for (const mark of marks) {
        if (mark.type === 'bold') text = `<b>${text}</b>`
        else if (mark.type === 'italic') text = `<i>${text}</i>`
        else if (mark.type === 'underline') text = `<u>${text}</u>`
        else if (mark.type === 'strike') text = `<s>${text}</s>`
        else if (mark.type === 'textStyle') {
          const color = mark.attrs?.color
          if (color) text = `<span style="color:${color}">${text}</span>`
        }
        else if (mark.type === 'highlight') {
          const bgColor = mark.attrs?.color || '#ffff00'
          text = `<span style="background-color:${bgColor}">${text}</span>`
        }
      }
      return text
    }
    if (n.type === 'image') {
      const src = (n.attrs?.src as string) || ''
      const w = (n.attrs?.width as string) || ''
      const h = (n.attrs?.height as string) || ''
      return `<img src="${src}"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''} style="max-width:100%">`
    }
    if (n.type === 'inlineMath') {
      return (n.attrs?.latex as string) || (n.text as string) || ''
    }
    if ((n as Record<string, unknown>).content) {
      return processInlineContent((n as Record<string, unknown>).content as unknown[])
    }
    return ''
  }).join('')
}

function nodeToHtml(node: Record<string, unknown>, _inList: boolean): string {
  const type = node.type as string
  if (type === 'paragraph') {
    const align = node.attrs?.textAlign as string || ''
    const style = align ? ` style="text-align:${align}"` : ''
    return `<p${style}>${processInlineContent((node.content as unknown[]) || [])}</p>`
  }
  if (type === 'heading') {
    const level = Math.min((node.attrs?.level as number) || 1, 3)
    const align = node.attrs?.textAlign as string || ''
    const style = align ? ` style="text-align:${align}"` : ''
    return `<h${level}${style}>${processInlineContent((node.content as unknown[]) || [])}</h${level}>`
  }
  if (type === 'image') {
    const src = (node.attrs?.src as string) || ''
    const w = (node.attrs?.width as string) || ''
    const h = (node.attrs?.height as string) || ''
    return `<p><img src="${src}"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''} style="max-width:100%"></p>`
  }
  if (type === 'blockMath') {
    const latex = (node.attrs?.latex as string) || ''
    return `<p style="text-align:center">${escapeHtml(latex)}</p>`
  }
  if (type === 'bulletList' || type === 'orderedList') {
    const tag = type === 'orderedList' ? 'ol' : 'ul'
    const items = ((node.content as Array<Record<string, unknown>>) || [])
      .filter(item => item.type === 'listItem')
      .map(item => {
        const childContent = ((item.content as Array<Record<string, unknown>>) || [])
          .map(child => nodeToHtml(child, true))
          .join('')
        return `<li>${childContent}</li>`
      })
      .join('')
    return `<${tag}>${items}</${tag}>`
  }
  return ''
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function copyRichContentToClipboard(content: Record<string, unknown>) {
  const html = tiptapToHtml(content)
  const plainText = contentToText(JSON.stringify(content))
  const htmlBlob = new Blob([html], { type: 'text/html' })
  const textBlob = new Blob([plainText], { type: 'text/plain' })
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
    ])
    return true
  } catch {
    try {
      const div = document.createElement('div')
      div.contentEditable = 'true'
      div.style.position = 'fixed'
      div.style.left = '-9999px'
      div.innerHTML = html
      document.body.appendChild(div)
      const range = document.createRange()
      range.selectNodeContents(div)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      document.execCommand('copy')
      document.body.removeChild(div)
      return true
    } catch {
      return false
    }
  }
}

export function ContentLibraryDialog({ isOpen, onClose, onApply, currentTitle, currentContent, currentName, onBatchCreateCards, standalone }: Props) {
  const [presets, setPresets] = useState<CardContentPreset[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchImportText, setBatchImportText] = useState('')
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [currentPage, setCurrentPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const jsonFileInputRef = useRef<HTMLInputElement>(null)
  const PAGE_SIZE = 20

  useEffect(() => {
    if (isOpen) {
      loadPresets()
    }
  }, [isOpen])

  useEffect(() => {
    setNewName(currentName || '')
  }, [currentName, isOpen])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMsg(msg)
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 1000)
  }

  const loadPresets = async () => {
    const all = await db.contentPresets.toArray()
    setPresets(sortPresets(all))
    setSelectedIds(new Set())
    setCurrentPage(1)
  }

  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return presets
    const q = searchQuery.toLowerCase()
    return presets.filter(p => {
      if (p.name.toLowerCase().includes(q)) return true
      if (p.title.toLowerCase().includes(q)) return true
      try {
        const c = JSON.parse(p.content)
        const preview = extractPreview(c).toLowerCase()
        if (preview.includes(q)) return true
      } catch {
        if (p.content.toLowerCase().includes(q)) return true
      }
      return false
    })
  }, [presets, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredPresets.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedPresets = filteredPresets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSave = async () => {
    const name = newName.trim() || currentTitle.trim()
    if (!name) return
    await db.contentPresets.add({
      id: uuid(),
      name,
      title: currentTitle,
      content: JSON.stringify(currentContent),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setNewName('')
    await loadPresets()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此项资料？')) return
    await db.contentPresets.delete(id)
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    await loadPresets()
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 项资料？`)) return
    await db.contentPresets.bulkDelete([...selectedIds])
    setSelectedIds(new Set())
    await loadPresets()
  }

  const handleTogglePin = async (preset: CardContentPreset) => {
    await db.contentPresets.update(preset.id, { pinned: !preset.pinned })
    await loadPresets()
  }

  const handleApply = (preset: CardContentPreset) => {
    let content: Record<string, unknown>
    try {
      content = JSON.parse(preset.content) as Record<string, unknown>
    } catch {
      content = { type: 'doc', content: [] }
    }
    onApply(preset.title, content, preset.name)
    onClose()
  }

  const handleBatchCreateCards = () => {
    if (selectedIds.size === 0 || !onBatchCreateCards) return
    const items: Array<{ title: string; content: Record<string, unknown>; name?: string }> = []
    for (const preset of presets) {
      if (selectedIds.has(preset.id)) {
        let content: Record<string, unknown>
        try {
          content = JSON.parse(preset.content) as Record<string, unknown>
        } catch {
          content = { type: 'doc', content: [] }
        }
        items.push({ title: preset.title, content, name: preset.name })
      }
    }
    onBatchCreateCards(items)
    onClose()
  }

  const startEdit = (preset: CardContentPreset) => {
    setEditingId(preset.id)
    setEditName(preset.name)
    setEditTitle(preset.title)
    setEditContent(preset.content)
  }

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    await db.contentPresets.update(id, {
      name,
      title: editTitle,
      content: editContent,
      updatedAt: Date.now(),
    })
    setEditingId(null)
    await loadPresets()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const visibleIds = new Set(filteredPresets.map(p => p.id))
    const selectedVisible = [...selectedIds].filter(id => visibleIds.has(id))
    if (selectedVisible.length === filteredPresets.length && filteredPresets.length > 0) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const id of visibleIds) next.delete(id)
        return next
      })
    } else {
      setSelectedIds(prev => new Set([...prev, ...visibleIds]))
    }
  }

  const handleBatchImport = async () => {
    const text = batchImportText.trim()
    if (!text) return

    const blocks = text.split(/\n(?=##\s)/)
    const items: Array<{ name: string; title: string; content: string }> = []

    for (const block of blocks) {
      const lines = block.trim().split('\n')
      if (lines.length === 0) continue

      const firstLine = lines[0].replace(/^##\s*/, '').trim()
      if (!firstLine) continue

      const title = firstLine
      let name = ''
      let bodyStart = 1

      if (lines.length > 1 && lines[1].trim().startsWith('@@')) {
        name = lines[1].replace(/^@@\s*/, '').trim()
        bodyStart = 2
      }

      if (!name) name = title

      const bodyLines = lines.slice(bodyStart).map(l => l.trim()).filter(l => l)
      let content: string
      if (bodyLines.length > 0) {
        const docContent = bodyLines.map(line => ({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        }))
        content = JSON.stringify({ type: 'doc', content: docContent })
      } else {
        content = JSON.stringify({ type: 'doc', content: [] })
      }

      items.push({ name, title, content })
    }

    if (items.length === 0) {
      alert('未能解析任何资料条目。请确保格式正确：用 ## 标注标题，可选 @@ 标注名称。')
      return
    }

    const now = Date.now()
    for (const item of items) {
      await db.contentPresets.add({
        id: uuid(),
        name: item.name,
        title: item.title,
        content: item.content,
        createdAt: now,
        updatedAt: now,
      })
    }

    setBatchImportText('')
    setShowBatchImport(false)
    await loadPresets()
    alert(`成功导入 ${items.length} 条资料。`)
  }

  const handleExportTxt = () => {
    const lines: string[] = []
    for (const p of presets) {
      lines.push(`## ${p.title}`)
      lines.push(`@@ ${p.name || p.title}`)
      const body = contentToText(p.content)
      if (body) {
        lines.push(body)
      }
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.download = `KnowCard_卡片资料库_${dateStr}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportJson = () => {
    const data = presets.map(p => ({
      name: p.name,
      title: p.title,
      content: p.content,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.download = `KnowCard_卡片资料库_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setBatchImportText(text)
      setShowBatchImport(true)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (!Array.isArray(data)) {
          alert('JSON 格式不正确：应为数组')
          return
        }
        const now = Date.now()
        let imported = 0
        for (const item of data as Array<Record<string, unknown>>) {
          if (!item.name && !item.title) continue
          await db.contentPresets.add({
            id: uuid(),
            name: (item.name as string) || (item.title as string) || '',
            title: (item.title as string) || '',
            content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content || { type: 'doc', content: [] }),
            createdAt: (item.createdAt as number) || now,
            updatedAt: (item.updatedAt as number) || now,
          })
          imported++
        }
        await loadPresets()
        alert(`成功导入 ${imported} 条资料`)
      } catch {
        alert('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  if (!isOpen) return null

  const showBatchFeatures = !!onBatchCreateCards

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '680px', maxWidth: '95%', display: 'flex', flexDirection: 'column', ...(standalone ? { height: '80vh' } : {}) }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <h3>卡片资料库</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>
        {toastMsg && (
          <div style={{ background: '#4caf50', color: '#fff', textAlign: 'center', padding: '8px 16px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Check size={16} />
            {toastMsg}
          </div>
        )}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          {!standalone && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                placeholder="输入资料名称（留空则用标题作为名称）…"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: 14 }}
              />
              <button className="btn-primary" onClick={handleSave} disabled={!currentTitle.trim()} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} />
                保存当前卡片资料
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索资料（标题、正文、名称）…"
                style={{ width: '100%', padding: '8px 12px', paddingLeft: 34, border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: 14 }}
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center' }}
                title="清除搜索"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowBatchImport(!showBatchImport)}
              style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={14} />
              {showBatchImport ? '收起批量导入' : '批量导入'}
            </button>
            <button onClick={handleExportTxt} style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} />
              导出TXT
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} />
              导入TXT
            </button>
            <button onClick={handleExportJson} style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} />
              导出JSON
            </button>
            <button onClick={() => jsonFileInputRef.current?.click()} style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} />
              导入JSON
            </button>
            <input ref={fileInputRef} type="file" accept=".txt" onChange={handleImportFile} style={{ display: 'none' }} />
            <input ref={jsonFileInputRef} type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
            {showBatchFeatures && (
              <>
                <button onClick={toggleSelectAll} style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {filteredPresets.length > 0 && [...selectedIds].filter(id => new Set(filteredPresets.map(p => p.id)).has(id)).length === filteredPresets.length ? '取消全选' : '全选'}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <button onClick={handleBatchDelete} style={{ padding: '5px 10px', fontSize: 12, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--danger-color)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      批量删除 ({selectedIds.size})
                    </button>
                    <button onClick={handleBatchCreateCards} style={{ padding: '5px 10px', fontSize: 12, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      批量创建卡片 ({selectedIds.size})
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          {showBatchImport && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                格式说明：用 <code>##</code> 标注标题，可选 <code>@@</code> 标注名称（不写则用标题作为名称），后接正文（多行）。
              </div>
              <textarea
                value={batchImportText}
                onChange={(e) => setBatchImportText(e.target.value)}
                placeholder={`## 第一条卡片的标题\n@@ 第一条资料的名称\n正文第一行\n正文第二行\n\n## 第二条卡片的标题\n正文第一行`}
                rows={8}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 12, resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <button
                onClick={handleBatchImport}
                disabled={!batchImportText.trim()}
                style={{ marginTop: 6, padding: '5px 12px', fontSize: 12, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer' }}
              >
                导入上述资料
              </button>
            </div>
          )}
        </div>
        <div style={{ padding: '8px 32px', ...(standalone ? { flex: 1, overflowY: 'auto' as const } : { maxHeight: 380, overflowY: 'auto' as const }) }}>
          {filteredPresets.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 13 }}>
              {searchQuery.trim() ? `未找到匹配"${searchQuery}"的资料` : '暂无保存的资料'}
            </div>
          )}
          {pagedPresets.map(p => (
            <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
              {editingId === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="名称"
                    style={{ padding: '4px 6px', border: '1px solid var(--accent-color)', borderRadius: 2, fontSize: 13 }}
                  />
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="标题"
                    style={{ padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 2, fontSize: 13 }}
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="内容（JSON格式）"
                    rows={3}
                    style={{ padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 2, fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSaveEdit(p.id)} style={{ padding: '6px 12px', fontSize: 13, border: 'none', borderRadius: '8px', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={14} />
                      保存
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ padding: '6px 12px', fontSize: 13, border: 'none', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <X size={14} />
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => handleTogglePin(p)}
                      title={p.pinned ? '取消置顶' : '置顶'}
                      style={{ padding: '4px', fontSize: 14, border: 'none', borderRadius: '6px', background: 'transparent', color: p.pinned ? '#e74c3c' : '#999', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                    >
                      {p.pinned ? <PinIcon size={16} color="#e74c3c" /> : <PinOffIcon size={16} color="#999" />}
                    </button>
                    {showBatchFeatures && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        style={{ flexShrink: 0, cursor: 'pointer', width: 18, height: 18 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>— {p.title}</span></span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0, paddingLeft: 8 }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}>
                        {(() => { try { const c = JSON.parse(p.content); return extractPreview(c) } catch { return p.content.slice(0, 100) } })()}
                      </div>
                    </div>
                    {!standalone && (
                      <Tooltip text="应用">
                        <button onClick={() => handleApply(p)} style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: '8px', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={16} />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip text="编辑">
                      <button onClick={() => startEdit(p)} style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: '8px', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit size={16} />
                      </button>
                    </Tooltip>
                    <Tooltip text="复制">
                      <button onClick={async () => {
              try {
                const parsed = JSON.parse(p.content) as Record<string, unknown>
                const ok = await copyRichContentToClipboard(parsed)
                showToast(ok ? '已复制到剪贴板，可在Word中粘贴' : '复制失败')
              } catch { showToast('复制失败') }
            }} style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: '8px', background: '#4caf50', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardCopy size={16} />
            </button>
                    </Tooltip>
                    <Tooltip text="删除">
                      <button onClick={() => handleDelete(p.id)} style={{ padding: '8px', fontSize: 13, border: 'none', borderRadius: '8px', background: 'var(--danger-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '8px 32px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', cursor: safePage === 1 ? 'default' : 'pointer', opacity: safePage === 1 ? 0.4 : 1 }}
            >««</button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', cursor: safePage === 1 ? 'default' : 'pointer', opacity: safePage === 1 ? 0.4 : 1 }}
            >«</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 4px' }}>
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', cursor: safePage === totalPages ? 'default' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1 }}
            >»</button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', cursor: safePage === totalPages ? 'default' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1 }}
            >»»</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>共 {filteredPresets.length} 条</span>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
