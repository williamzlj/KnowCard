import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../../stores/useEditorStore'
import { useCardStore } from '../../stores/useCardStore'
import { usePageStore } from '../../stores/usePageStore'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { Mathematics } from '@tiptap/extension-mathematics'
import { NodeSelection } from '@tiptap/pm/state'
import { ContentLibraryDialog } from '../card/ContentLibraryDialog'
import { ColorPicker } from '../color/ColorPicker'
import { db } from '../../db/database'

const ResizableImageComponent = ({ node, updateAttributes }: { node: { attrs: Record<string, unknown> }; updateAttributes: (attrs: Record<string, unknown>) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const ratioRef = useRef<number | null>(null)

  const attrs = node.attrs
  const src = (attrs.src as string) || ''
  const attrWidth = attrs.width as string | undefined
  const attrHeight = attrs.height as string | undefined

  if (attrWidth && attrHeight && !ratioRef.current) {
    const w = parseFloat(attrWidth)
    const h = parseFloat(attrHeight)
    if (w > 0 && h > 0) ratioRef.current = w / h
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0) {
        const w = Math.round(rect.width)
        if (ratioRef.current && ratioRef.current > 0) {
          const h = Math.round(w / ratioRef.current)
          updateAttributes({ width: `${w}px`, height: `${h}px` })
        } else {
          updateAttributes({ width: `${w}px` })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateAttributes])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      ratioRef.current = img.naturalWidth / img.naturalHeight
      if (!attrWidth && !attrHeight) {
        updateAttributes({
          width: `${img.naturalWidth}px`,
          height: `${img.naturalHeight}px`,
        })
      }
    }
  }

  return (
    <NodeViewWrapper
      as="span"
      style={{
        display: 'inline-block',
        resize: 'horizontal',
        overflow: 'hidden',
        maxWidth: '100%',
        verticalAlign: 'bottom',
        ...(ratioRef.current ? { aspectRatio: String(ratioRef.current) } : {}),
        ...(attrWidth ? { width: attrWidth } : {}),
      }}
    >
      <img
        ref={containerRef}
        src={src}
        alt=""
        onLoad={handleImageLoad}
        style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
        draggable={false}
      />
    </NodeViewWrapper>
  )
}

const ResizableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },
})

const editorExtensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  ResizableImage,
  Mathematics,
]

const MenuBar = ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
  if (!editor) return null

  const addImage = useCallback(() => {
    const url = window.prompt('输入图片 URL:')
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  return (
    <div className="editor-toolbar">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? 'is-active' : ''}
      >
        <u>U</u>
      </button>

      <div className="divider" />

      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
      >
        左对齐
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
      >
        居中
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
      >
        右对齐
      </button>

      <div className="divider" />

      <select
        onChange={(e) => {
          const level = parseInt(e.target.value, 10) as 1 | 2 | 3 | 0
          if (level === 0) {
            editor.chain().focus().setParagraph().run()
          } else {
            editor.chain().focus().toggleHeading({ level }).run()
          }
        }}
        style={{ padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
      >
        <option value="0">正文</option>
        <option value="1">标题1</option>
        <option value="2">标题2</option>
        <option value="3">标题3</option>
      </select>

      <div className="divider" />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()}>• 列表</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 列表</button>

      <div className="divider" />

      <button onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="清除文字格式">
        ✕ 清除格式
      </button>

      <button onClick={addImage}>🖼 插入图片</button>

      {editor.isActive('image') && (
        <>
          <div className="divider" />
          <input
            type="text"
            value={editor.getAttributes('image').width || ''}
            onChange={(e) => {
              editor.chain().setNodeSelection(editor.state.selection.from).updateAttributes('image', { width: e.target.value || null }).run()
            }}
            placeholder="图片宽度"
            style={{ width: 65, padding: '2px 4px', border: '1px solid var(--accent-color)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
          />
          <input
            type="text"
            value={editor.getAttributes('image').height || ''}
            onChange={(e) => {
              editor.chain().setNodeSelection(editor.state.selection.from).updateAttributes('image', { height: e.target.value || null }).run()
            }}
            placeholder="图片高度"
            style={{ width: 65, padding: '2px 4px', border: '1px solid var(--accent-color)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}
          />
        </>
      )}

      <div className="divider" />

      <ColorPicker
        value={editor.getAttributes('textStyle').color || '#000000'}
        onChange={(color) => editor.chain().focus().setColor(color).run()}
      />
      <ColorPicker
        value={editor.getAttributes('highlight').color || '#ffff00'}
        onChange={(color) => editor.chain().focus().setHighlight({ color }).run()}
      />

      <div className="divider" />

      <button onClick={() => editor.chain().focus().undo().run()}>↩ 撤销</button>
      <button onClick={() => editor.chain().focus().redo().run()}>↪ 重做</button>
    </div>
  )
}

function sanitizeContent(node: Record<string, unknown>): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return node
  const cloned = { ...node }
  if (Array.isArray(cloned.content)) {
    const cleaned = cloned.content
      .map((child: unknown) => sanitizeContent(child as Record<string, unknown>))
      .filter((child: Record<string, unknown> | null) => {
        if (!child) return false
        if (child.type === 'text' && (!child.text || (child.text as string).length === 0)) return false
        return true
      })
    cloned.content = cleaned
  }
  return cloned
}

function CardEditor({ cardId, onSave, onClose }: { cardId: string; onSave: (title: string, cardName: string, cardNumber: number) => void; onClose: () => void }) {
  const { cards, renumberCard } = useCardStore()
  const { pages } = usePageStore()
  const [title, setTitle] = useState('')
  const [cardName, setCardName] = useState('')
  const [contentLibOpen, setContentLibOpen] = useState(false)
  const [cardNumber, setCardNumber] = useState(0)
  const [initContent, setInitContent] = useState<Record<string, unknown> | null>(null)

  const card = cards.find(c => c.id === cardId)

  const currentCardNumber = useMemo(() => {
    if (!card) return 0
    let num = 1
    const sortedPages = [...pages].sort((a, b) => a.order - b.order)
    for (const page of sortedPages) {
      const pageCards = cards.filter(c => c.pageId === page.id).sort((a, b) => a.order - b.order)
      for (const c of pageCards) {
        if (c.id === card.id) return num
        if (!c.flags.excludeFromNumbering) num++
      }
    }
    return num
  }, [cards, card, pages])

  useEffect(() => {
    if (!cardId) return
    const fetchCard = async () => {
      try {
        const cardData = await db.cards.get(cardId)
        if (cardData?.content) {
          const content = typeof cardData.content === 'string'
            ? JSON.parse(cardData.content)
            : cardData.content
          if (content && typeof content === 'object' && content.type === 'doc' && Array.isArray(content.content)) {
            const cleaned = sanitizeContent(content as Record<string, unknown>)
            setInitContent(cleaned ?? { type: 'doc', content: [] })
            return
          }
        }
        setInitContent({ type: 'doc', content: [] })
      } catch {
        setInitContent({ type: 'doc', content: [] })
      }
    }
    fetchCard()
  }, [cardId])

  useEffect(() => {
    if (card) {
      setTitle(card.title || '')
      setCardName(card.name || '')
    }
  }, [card])

  useEffect(() => {
    if (currentCardNumber > 0) setCardNumber(currentCardNumber)
  }, [currentCardNumber])

  const editor = useEditor(
    {
      extensions: editorExtensions,
      content: initContent ?? { type: 'doc', content: [] },
      editorProps: {
        handleDOMEvents: {
          click: (_view: unknown, event: Event) => {
            const target = event.target as HTMLElement
            if (target.tagName === 'IMG' && target.closest('.ProseMirror')) {
              const view = _view as { posAtDOM: (dom: Node, offset: number) => number; state: { doc: { resolve: (pos: number) => { start: () => number }; nodeAt: (pos: number) => { type: { name: string } | null } | null }; tr: { setSelection: (sel: unknown) => unknown } } }
              const pos = view.posAtDOM(target, 0)
              const $pos = view.state.doc.resolve(pos)
              const nodeStart = $pos.start()
              const node = view.state.doc.nodeAt(nodeStart)
              if (node?.type.name === 'image') {
                const tr = view.state.tr
                tr.setSelection(NodeSelection.create(view.state.doc, nodeStart))
                ;(view as { dispatch: (tr: unknown) => void }).dispatch(tr)
              }
            }
            return false
          },
        },
        handlePaste: (_view: unknown, event: ClipboardEvent) => {
          const view = _view as { state: { schema: { nodes: { image: { create: (attrs: Record<string, unknown>) => unknown } } }; tr: { replaceSelectionWith: (node: unknown) => unknown } }; dispatch: (tr: unknown) => void }
          const items = event.clipboardData?.items
          if (!items) return false
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              event.preventDefault()
              const file = item.getAsFile()
              if (!file) continue
              const reader = new FileReader()
              reader.onload = () => {
                const dataUrl = reader.result as string
                const node = view.state.schema.nodes.image.create({ src: dataUrl })
                const tr = view.state.tr.replaceSelectionWith(node)
                view.dispatch(tr)
              }
              reader.readAsDataURL(file)
              return true
            }
          }
          return false
        },
      },
    },
    [initContent]
  )

  const handleSave = () => {
    if (!cardId || !editor) return
    const rawContent = editor.getJSON()
    const content = sanitizeContent(rawContent as Record<string, unknown>) ?? { type: 'doc', content: [] }
    useCardStore.getState().updateCard(cardId, {
      title: title || '未命名卡片',
      name: cardName || undefined,
      content,
    })
    if (cardNumber > 0 && cardNumber !== currentCardNumber) {
      renumberCard(cardId, cardNumber)
    }
    onSave(title, cardName, cardNumber)
  }

  if (!card) return null
  if (!initContent) return <div className="modal-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><span style={{ color: 'var(--text-muted)' }}>加载中…</span></div>

  return (
    <>
      <div style={{ padding: '12px 48px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>卡片名称</label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 15 }}
              placeholder="输入卡片名称（选填）"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>卡片编号</label>
            <input
              type="number"
              min={1}
              value={cardNumber || ''}
              onChange={(e) => setCardNumber(Number(e.target.value) || 0)}
              style={{ width: 80, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 15 }}
            />
          </div>
        </div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>卡片标题</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 15 }}
            placeholder="输入卡片标题"
          />
          <button
            onClick={() => setContentLibOpen(true)}
            style={{ padding: '8px 12px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            title="从资料库导入"
          >
            📋 资料库
          </button>
        </div>
      </div>

      {editor && <MenuBar editor={editor} />}

      <div className="modal-body">
        <EditorContent editor={editor} />
      </div>

      <div className="modal-footer">
        <button className="btn-cancel" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={handleSave}>保存</button>
      </div>
      <ContentLibraryDialog
        isOpen={contentLibOpen}
        onClose={() => setContentLibOpen(false)}
        onApply={(t, c, n) => {
            setTitle(t)
            setCardName(n)
            const cleaned = sanitizeContent(c as Record<string, unknown>)
            editor?.commands.setContent(cleaned ?? { type: 'doc', content: [] })
          }}
        currentTitle={title}
        currentContent={editor?.getJSON() || { type: 'doc', content: [] }}
        currentName={cardName}
      />
    </>
  )
}

export function EditorModal() {
  const { isOpen, cardId, closeEditor } = useEditorStore()
  const { cards } = useCardStore()
  const overlayMouseDownRef = useRef(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditor()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, closeEditor])

  const handleSave = useCallback(() => {
    closeEditor()
  }, [closeEditor])

  const card = cards.find(c => c.id === cardId)

  if (!isOpen || !card) return null

  return (
    <div ref={overlayRef} className="modal-overlay" onMouseDown={(e) => { overlayMouseDownRef.current = e.target === e.currentTarget }} onClick={() => { if (overlayMouseDownRef.current) closeEditor() }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '85%', maxWidth: 1000 }}>
        <div className="modal-header">
          <h3>编辑卡片</h3>
          <button onClick={closeEditor} style={{ fontSize: 20, padding: '0 8px' }}>×</button>
        </div>
        <CardEditor key={cardId} cardId={cardId} onSave={handleSave} onClose={closeEditor} />
      </div>
    </div>
  )
}
