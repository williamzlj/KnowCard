import { useState } from 'react'

interface Props {
  initialX: number
  initialY: number
  onConfirm: (text: string, align: string) => void
  onCancel: () => void
}

const FONT_SIZE = 16
const CHAR_W = FONT_SIZE
const CHAR_W_EN = FONT_SIZE * 0.6
const LINE_H = FONT_SIZE * 1.4
const PADDING = 8

function estimateWidth(text: string): number {
  let w = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) {
      w += CHAR_W
    } else {
      w += CHAR_W_EN
    }
  }
  return w
}

export function TextInputDialog({ initialX, initialY, onConfirm, onCancel }: Props) {
  const [text, setText] = useState('')
  const [align, setAlign] = useState('left')

  const handleConfirm = () => {
    if (!text.trim()) return
    onConfirm(text, align)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleConfirm()
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  const alignBtnStyle = (a: string): React.CSSProperties => ({
    padding: '4px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    background: align === a ? 'var(--accent-color)' : 'var(--bg-secondary)',
    color: align === a ? '#fff' : 'var(--text-primary)',
    fontSize: 12,
    cursor: 'pointer',
  })

  return (
    <div
      className="modal-overlay"
      style={{ background: 'transparent' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: Math.min(initialX, window.innerWidth - 320),
          top: Math.min(initialY, window.innerHeight - 200),
          width: 300,
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 1000,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500 }}>输入文本内容</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入文本…"
          autoFocus
          rows={4}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            lineHeight: 1.5,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>对齐方式：</span>
          <button style={alignBtnStyle('left')} onClick={() => setAlign('left')}>左对齐</button>
          <button style={alignBtnStyle('center')} onClick={() => setAlign('center')}>居中</button>
          <button style={alignBtnStyle('right')} onClick={() => setAlign('right')}>右对齐</button>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '6px 16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 13 }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!text.trim()}
            style={{ padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: 13, opacity: text.trim() ? 1 : 0.5 }}
          >
            确定
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Ctrl+Enter 确认 · Esc 取消</div>
      </div>
    </div>
  )
}

export function computeTextElementSize(text: string): { width: number; height: number } {
  const lines = text.split('\n')
  let maxLineW = 0
  for (const line of lines) {
    const w = estimateWidth(line)
    if (w > maxLineW) maxLineW = w
  }
  const contentW = maxLineW + PADDING * 2
  const contentH = lines.length * LINE_H + PADDING * 2
  const widthMm = Math.max(20, Math.ceil(contentW / 3.779527559))
  const heightMm = Math.max(10, Math.ceil(contentH / 3.779527559))
  return { width: widthMm, height: heightMm }
}
