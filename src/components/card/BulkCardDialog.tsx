import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../../db/database'
import { useCardStore } from '../../stores/useCardStore'
import { usePageStore } from '../../stores/usePageStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { calcCardSize } from '../../utils/cardSize'
import type { CardStyle, CardFlags } from '../../types/card'

function tiptapToPlainText(content: Record<string, unknown> | null | undefined): string {
  if (!content || !content.content) return ''
  const lines: string[] = []
  const walk = (nodes: unknown[]) => {
    for (const node of nodes as Array<Record<string, unknown>>) {
      if (node.text) lines.push(node.text as string)
      if (node.content) walk(node.content as unknown[])
      if (node.type === 'paragraph' || node.type === 'heading') lines.push('')
    }
  }
  walk(content.content as unknown[])
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface BulkCardDialogProps {
  isOpen?: boolean
  onClose?: () => void
  mode?: 'import' | 'export'
  showButtons?: boolean
}

export interface BulkCardDialogRef {
  openImport: () => void
  openExport: () => void
}

export const BulkCardDialog = forwardRef<BulkCardDialogRef, BulkCardDialogProps>(({ isOpen: externalIsOpen, onClose, mode: externalMode, showButtons = true }, ref) => {
  const [isOpenInternal, setIsOpenInternal] = useState(false)
  const [mode, setMode] = useState<'import' | 'export'>('import')
  const [text, setText] = useState('')
  const openExportRef = useRef<() => void>(() => {})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOpen = externalIsOpen ?? isOpenInternal
  const setIsOpen = (open: boolean) => {
    if (onClose && !open) onClose()
    setIsOpenInternal(open)
  }

  // 暴露外部调用的方法
  useImperativeHandle(ref, () => ({
    openImport: () => {
      setMode('import')
      setText('')
      setIsOpen(true)
    },
    openExport: () => {
      openExportRef.current()
    }
  }))

  // 如果传入外部 mode，同步内部 state
  useEffect(() => {
    if (externalMode) setMode(externalMode)
  }, [externalMode])

  const { cards, selectedCardIds } = useCardStore()
  const { currentPageId } = usePageStore()
  const { currentProjectId, projects } = useProjectStore()

  openExportRef.current = () => {
    const sorted = [...cards].sort((a, b) => a.order - b.order)
    const output = sorted.map(c => {
      const name = c.name || c.title
      return `## ${c.title}\n@@ ${name}\n${tiptapToPlainText(c.content)}`
    }).join('\n\n')
    setMode('export')
    setText(output)
    setIsOpen(true)
  }

  const openImport = () => {
    setMode('import')
    setText('')
    setIsOpen(true)
  }

  const handleImport = async () => {
    if (!currentProjectId || !currentPageId) return
    const blocks = text.split(/\n(?=##\s)/)

    const { cards: allCards } = useCardStore.getState()

    let insertOrder: number
    if (selectedCardIds.length > 0) {
      const maxOrder = Math.max(...selectedCardIds.map(id => {
        const found = allCards.find(c => c.id === id)
        return found ? found.order : 0
      }))
      insertOrder = maxOrder + 1
    } else {
      insertOrder = allCards.length
    }

    const newCards: Array<{
      id: string; projectId: string; pageId: string; name: string; title: string
      content: Record<string, unknown>; style: CardStyle
      size: { defaultWidth: number; defaultHeight: number; projectWidth: number; projectHeight: number }
      flags: CardFlags; position: { x: number; y: number }
      order: number; createdAt: number; updatedAt: number
    }> = []

    let orderOffset = 0
    for (const block of blocks) {
      const lines = block.trim().split('\n')
      if (lines.length === 0 || !lines[0].startsWith('## ')) continue

      const title = lines[0].replace(/^##\s+/, '').trim()
      if (!title) continue

      let name = ''
      let bodyStart = 1

      if (lines.length > 1 && lines[1].trim().startsWith('@@')) {
        name = lines[1].replace(/^@@\s*/, '').trim()
        bodyStart = 2
      }

      if (!name) name = title

      const bodyLines = lines.slice(bodyStart).join('\n').trim()
      const content = bodyLines
        ? {
            type: 'doc',
            content: bodyLines.split('\n').map(line => ({
              type: 'paragraph',
              content: [{ type: 'text', text: line }],
            })),
          }
        : { type: 'doc', content: [] }

      const computed = calcCardSize(title, content as unknown as Record<string, unknown>)

      newCards.push({
        id: uuid(),
        projectId: currentProjectId,
        pageId: currentPageId,
        name,
        title,
        content,
        style: {
          titleFont: '黑体',
          titleBold: true,
          titleColor: '#000000',
          titleBackgroundColor: '#e8f4fd',
          bodyFont: '宋体',
          bodyColor: '#333333',
          bodyBackgroundColor: '#ffffff',
          borderColor: '#4a90d9',
          borderWidth: 1,
          borderRadius: 4,
        } as CardStyle,
        size: { defaultWidth: computed.width, defaultHeight: computed.height, projectWidth: computed.width, projectHeight: computed.height },
        flags: {
          hideBorder: false,
          hideTitle: false,
          hideBody: false,
          showNumber: false,
          excludeFromLayout: false,
          excludeFromNumbering: false,
        } as CardFlags,
        position: { x: 0, y: 0 },
        order: insertOrder + orderOffset,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      orderOffset++
    }

    if (newCards.length === 0) return

    for (const card of newCards) {
      await db.cards.add(card)
    }

    const { projectId } = newCards[0]
    if (projectId) {
      await useCardStore.getState().loadCards(projectId)
    }
    setIsOpen(false)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  const handleExportTxt = () => {
    const sorted = [...cards].sort((a, b) => a.order - b.order)
    const output = sorted.map(c => {
      const name = c.name || c.title
      return `## ${c.title}\n@@ ${name}\n${tiptapToPlainText(c.content)}`
    }).join('\n\n')
    const dateStr = formatDate(new Date())
    const projectName = projects.find(p => p.id === currentProjectId)?.name || 'project'
    const filename = `KnowCard_${projectName}_${dateStr}.txt`
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportTxt = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target?.result as string
      setMode('import')
      setText(content)
      setIsOpen(true)
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  return (
    <>
      {showButtons && (
        <>
          <button onClick={openImport} style={{ padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} title="批量导入卡片">
            📥 批量导入
          </button>
          <button onClick={() => openExportRef.current()} style={{ padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} title="批量导出卡片">
            📤 批量导出
          </button>
        </>
      )}
      <input ref={fileInputRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={handleFileChange} />
      {isOpen && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }} onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '700px', maxWidth: '90%' }}>
            <div className="modal-header">
              <h3>{mode === 'import' ? '批量导入卡片' : '批量导出卡片'}</h3>
              <button onClick={() => setIsOpen(false)} style={{ fontSize: 20, padding: '0 8px' }}>×</button>
            </div>
            <div style={{ padding: '16px 48px', borderBottom: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
              {mode === 'import'
                ? '每张卡片以 "## 标题" 开头，可选第二行 "@@ 名称"，后面接正文。下一个 "##" 开始新卡片。'
                : '导出的文本格式与导入格式相同，可直接复制后用于批量导入。'}
            </div>
            <div style={{ padding: '16px 48px' }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={mode === 'export'}
                placeholder="## 标题1\n@@ 名称1\n正文1\n\n## 标题2\n@@ 名称2\n正文2 - 第一行\n正文2 - 第二行\n\n## 标题3\n正文3"
                style={{
                  width: '100%',
                  height: 360,
                  padding: 12,
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  fontFamily: 'monospace',
                }}
              />
            </div>
            <div className="modal-footer" style={{ gap: 8 }}>
              {mode === 'import' ? (
                <>
                  <button className="btn-cancel" onClick={() => setIsOpen(false)}>取消</button>
                  <button className="btn-cancel" onClick={handleImportTxt}>导入TXT文件</button>
                  <button className="btn-primary" onClick={handleImport} disabled={!text.trim()}>导入</button>
                </>
              ) : (
                <>
                  <button className="btn-cancel" onClick={handleExportTxt}>导出TXT文件</button>
                  <button className="btn-cancel" onClick={handleCopy}>复制到剪贴板</button>
                  <button className="btn-cancel" onClick={() => setIsOpen(false)}>关闭</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
})
