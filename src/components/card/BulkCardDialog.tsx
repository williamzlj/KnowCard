import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Bookmark } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { db } from '../../db/database'
import { RegexLibraryDialog } from './RegexLibraryDialog'
import { useCardStore } from '../../stores/useCardStore'
import { usePageStore } from '../../stores/usePageStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { calcCardSize } from '../../utils/cardSize'
import { getSafeArea } from '../../types/page'
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
  const [regexPattern, setRegexPattern] = useState('')
  const [regexReplace, setRegexReplace] = useState('')
  const [showRegexHelp, setShowRegexHelp] = useState(false)
  const [regexLibOpen, setRegexLibOpen] = useState(false)
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

    // 获取页面信息以计算安全区域
    const page = await db.pages.get(currentPageId)
    const safeWidth = page ? getSafeArea(page).width : Number.MAX_VALUE

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

      const computed = calcCardSize(title, content as unknown as Record<string, unknown>, undefined, undefined, undefined, 4, 10)
      const limitedWidth = Math.min(computed.width, safeWidth)

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
          titlePaddingY: 4,
          bodyFont: '宋体',
          bodyColor: '#333333',
          bodyBackgroundColor: '#ffffff',
          bodyLineHeight: 1.5,
          paddingX: 10,
          borderColor: '#4a90d9',
          borderWidth: 1,
          borderRadius: 4,
        } as CardStyle,
        size: { defaultWidth: limitedWidth, defaultHeight: computed.height, projectWidth: limitedWidth, projectHeight: computed.height },
        flags: {
          hideBorder: false,
          hideTitle: false,
          hideBody: false,
          hideBodyArea: false,
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

  const resolveReplaceStr = (str: string): string => {
    return str.replace(/\\\\/g, '\x00').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\x00/g, '\\')
  }

  const handleRegexReplace = () => {
    if (!regexPattern) return
    try {
      const regex = new RegExp(regexPattern, 'gm')
      const result = text.replace(regex, resolveReplaceStr(regexReplace))
      setText(result)
    } catch {
      alert('正则表达式格式错误')
    }
  }

  const regexPreview = useMemo(() => {
    if (!regexPattern || !text) return null
    try {
      const regex = new RegExp(regexPattern, 'gm')
      const matches = [...text.matchAll(regex)]
      if (matches.length === 0) return { count: 0, preview: null, matches: [] as string[] }
      const result = text.replace(regex, resolveReplaceStr(regexReplace))
      const matchTexts = matches.map(m => m[0].slice(0, 40) + (m[0].length > 40 ? '…' : ''))
      return { count: matches.length, preview: result, matches: matchTexts }
    } catch {
      return null
    }
  }, [text, regexPattern, regexReplace])

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
        <div className="modal-overlay">
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
            <div style={{ padding: '0 48px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={regexPattern}
                onChange={(e) => setRegexPattern(e.target.value)}
                placeholder="正则查找（如 \\n\\n）"
                style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
              />
              <input
                value={regexReplace}
                onChange={(e) => setRegexReplace(e.target.value)}
                placeholder="替换为"
                style={{ flex: 1, minWidth: 140, padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
              />
              <button
                onClick={handleRegexReplace}
                disabled={!regexPattern}
                style={{ padding: '6px 16px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 6, background: regexPattern ? 'var(--accent-color)' : 'var(--bg-tertiary)', color: regexPattern ? '#fff' : 'var(--text-muted)', cursor: regexPattern ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
              >
                全部替换
              </button>
              <button
                onClick={() => setShowRegexHelp(!showRegexHelp)}
                title="正则替换帮助"
                style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 6, background: showRegexHelp ? 'var(--bg-tertiary)' : '#fff', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
              >
                ?
              </button>
              <button
                onClick={() => setRegexLibOpen(true)}
                title="正则资料库"
                style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 6, background: '#fff', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Bookmark size={14} />
              </button>
              <button
                onClick={() => { setRegexPattern(''); setRegexReplace('') }}
                title="清空规则"
                style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 6, background: '#fff', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                清空
              </button>
            </div>
            {showRegexHelp && (
              <div style={{ padding: '0 48px 12px' }}>
                <div style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)', fontSize: 12, lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-color)' }}>常用正则替换：</div>
                  <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\n\\n'}</code> → 替换为单个字符，可合并空行</div>
                  <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'^\\s+|\\s+$'}</code> → 替换为空，去除首尾空格</div>
                  <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\n{3,}'}</code> → 替换为 <code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\n\\n'}</code>，合并多个空行</div>
                  <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'^##\\s.*\\n?'}</code> → 替换为空，删除所有卡片标题行</div>
                  <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'（.*?）'}</code> → 替换为空，删除中文括号内容</div>
                  <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\(.*?\\)'}</code> → 替换为空，删除英文括号内容</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>使用 <code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'$1'}</code>、<code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'$2'}</code> 等引用捕获组。正则引擎自动开启 g、m 标志。</div>
                </div>
              </div>
            )}
            {regexPreview && (
              <div style={{ padding: '0 48px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, position: 'relative' }}>
                  <span style={{ fontSize: 12, color: regexPreview.count > 0 ? '#4caf50' : 'var(--text-muted)' }}>
                    {regexPreview.count > 0 ? `找到 ${regexPreview.count} 处匹配` : '无匹配'}
                  </span>
                  {regexPreview.matches.length > 0 && (
                    <details style={{ fontSize: 12 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', userSelect: 'none' }}>查看匹配内容</summary>
                      <div style={{
                        position: 'absolute', left: 0, top: '100%', zIndex: 10,
                        maxHeight: 100, overflowY: 'auto', padding: '6px 8px', marginTop: 4,
                        border: '1px solid var(--border-color)', borderRadius: 4,
                        background: 'var(--bg-secondary)', fontFamily: 'monospace', fontSize: 11,
                        lineHeight: 1.6, color: 'var(--text-secondary)', minWidth: 200,
                      }}>
                        {regexPreview.matches.map((m, i) => (
                          <div key={i} style={{ padding: '1px 0' }}>
                            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{i + 1}.</span>
                            <span style={{ background: '#fff3cd', padding: '0 2px', borderRadius: 2 }}>{m}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                {regexPreview.preview && (
                  <div style={{
                    maxHeight: 120, overflowY: 'auto', padding: '8px 10px',
                    border: '1px solid var(--border-color)', borderRadius: 6,
                    background: 'var(--bg-secondary)', fontSize: 12, fontFamily: 'monospace',
                    lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    color: 'var(--text-secondary)',
                  }}>
                    {regexPreview.preview}
                  </div>
                )}
              </div>
            )}
            <div className="modal-footer" style={{ gap: 8 }}>
              {mode === 'import' ? (
                <>
                  <button className="btn-cancel" onClick={() => setIsOpen(false)}>取消</button>
                  <button className="btn-cancel" onClick={() => setText(text.replace(/\n\n/g, '\n'))}>合并空行</button>
                  <button className="btn-cancel" onClick={handleImportTxt}>导入TXT文件</button>
                  <button className="btn-primary" onClick={handleImport} disabled={!text.trim()}>导入</button>
                </>
              ) : (
                <>
                  <button className="btn-cancel" onClick={handleExportTxt}>导出TXT文件</button>
                  <button className="btn-cancel" onClick={handleCopy}>复制到剪贴板</button>
                  <button className="btn-cancel" onClick={() => setText(text.replace(/\n\n/g, '\n'))}>合并空行</button>
                  <button className="btn-cancel" onClick={() => setIsOpen(false)}>关闭</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <RegexLibraryDialog
        isOpen={regexLibOpen}
        onClose={() => setRegexLibOpen(false)}
        onLoad={(pattern, replace) => {
          setRegexPattern(pattern)
          setRegexReplace(replace)
          setRegexLibOpen(false)
        }}
        currentPattern={regexPattern}
        currentReplace={regexReplace}
      />
    </>
  )
})
