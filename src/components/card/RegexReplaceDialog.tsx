import { useState, useMemo } from 'react'
import { Bookmark, ClipboardCopy, ClipboardPaste, Download, Combine } from 'lucide-react'
import { RegexLibraryDialog } from './RegexLibraryDialog'

interface Props {
  isOpen: boolean
  onClose: () => void
}

function resolveReplaceStr(str: string): string {
  return str.replace(/\\\\/g, '\x00').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\x00/g, '\\')
}

export function RegexReplaceDialog({ isOpen, onClose }: Props) {
  const [text, setText] = useState('')
  const [regexPattern, setRegexPattern] = useState('')
  const [regexReplace, setRegexReplace] = useState('')
  const [showRegexHelp, setShowRegexHelp] = useState(false)
  const [regexLibOpen, setRegexLibOpen] = useState(false)

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

  if (!isOpen) return null

  const handleReplace = () => {
    if (!regexPattern) return
    try {
      const regex = new RegExp(regexPattern, 'gm')
      setText(text.replace(regex, resolveReplaceStr(regexReplace)))
    } catch {
      alert('正则表达式格式错误')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'))
  }

  const handleExportTxt = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `regex_replace_${dateStr}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText) {
        setText(clipboardText)
      } else {
        alert('剪贴板中没有文本内容')
      }
    } catch {
      alert('读取剪贴板失败，请确认已授予剪贴板权限')
    }
  }

  const handleMergeBlankLines = () => {
    setText(text.replace(/\n{3,}/g, '\n\n'))
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '95%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>正则替换</h3>
          <button onClick={onClose} style={{ fontSize: 20, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)' }}>×</button>
        </div>

        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={regexPattern}
            onChange={(e) => setRegexPattern(e.target.value)}
            placeholder="正则查找（如 \\n\\n）"
            style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
          />
          <input
            value={regexReplace}
            onChange={(e) => setRegexReplace(e.target.value)}
            placeholder="替换为（\\n=换行）"
            style={{ flex: 1, minWidth: 140, padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
          />
          <button
            onClick={handleReplace}
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
          <div style={{ padding: '0 24px 12px' }}>
            <div style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)', fontSize: 12, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-color)' }}>常用正则替换：</div>
              <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\n\\n'}</code> → 替换为单个字符，可合并空行</div>
              <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'^\\s+|\\s+$'}</code> → 替换为空，去除首尾空格</div>
              <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\n{3,}'}</code> → 替换为 <code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\n\\n'}</code>，合并多个空行</div>
              <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'^##\\s.*\\n?'}</code> → 替换为空，删除卡片标题行</div>
              <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'（.*?）'}</code> → 替换为空，删除中文括号内容</div>
              <div><code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'\\(.*?\\)'}</code> → 替换为空，删除英文括号内容</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>使用 <code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'$1'}</code>、<code style={{ background: '#e8e8e8', padding: '1px 4px', borderRadius: 3 }}>{'$2'}</code> 等引用捕获组。正则引擎自动开启 g、m 标志。</div>
            </div>
          </div>
        )}

        {regexPreview && (
          <div style={{ padding: '0 24px 12px' }}>
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

        <div style={{ padding: '12px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在此粘贴或输入要处理的文本..."
            style={{ flex: 1, minHeight: 250, padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical' }}
          />
        </div>

        <div className="modal-footer" style={{ gap: 8 }}>
          <button className="btn-cancel" onClick={handleExportTxt}>
            <Download size={14} style={{ marginRight: 4 }} />
            导出TXT文件
          </button>
          <button className="btn-cancel" onClick={handlePasteFromClipboard}>
            <ClipboardPaste size={14} style={{ marginRight: 4 }} />
            从剪贴板导入
          </button>
          <button className="btn-cancel" onClick={handleMergeBlankLines}>合并空行</button>
          <button className="btn-cancel" onClick={handleCopy}>
            <ClipboardCopy size={14} style={{ marginRight: 4 }} />
            复制结果
          </button>
          <button className="btn-cancel" onClick={() => setText('')}>清空文本</button>
          <button className="btn-cancel" onClick={onClose}>关闭</button>
        </div>
      </div>

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
    </div>
  )
}
