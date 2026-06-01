import { useState, useRef, useEffect } from 'react'
import { useProjectStore, usePageStore, useCardStore, useCanvasStore } from '../../stores'
import { usePageElementStore } from '../../stores/usePageElementStore'
import { BulkCardDialog, type BulkCardDialogRef } from '../card/BulkCardDialog'
import { PX_PER_MM } from '../../utils/cardSize'
import { useAuthStore } from '../../stores/useAuthStore'
import { 
  Home, 
  FilePlus, 
  Trash2, 
  Layers, 
  Columns, 
  List, 
  Type, 
  ArrowRight, 
  Square, 
  Image as ImageIcon, 
  Clipboard, 
  RefreshCw, 
  Maximize2, 
  Download, 
  Printer,
  ChevronLeft,
  User as UserIcon,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Plus
} from 'lucide-react'

interface TopToolbarProps {
  onGoToProjectManager?: () => void
  onGoToSettings?: () => void
  onGoToUserManagement?: () => void
  onLogout?: () => void
}

export function TopToolbar({ onGoToProjectManager }: TopToolbarProps) {
  const { projects, currentProjectId } = useProjectStore()
  const { pages, currentPageId: pageId, createPage, deletePage } = usePageStore()
  const { zoom } = useCanvasStore()
  const { activeTool } = usePageElementStore()
  const { currentUser } = useAuthStore()
  
  // 下拉菜单状态
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const [importExportMenuOpen, setImportExportMenuOpen] = useState(false)
  const [addElementMenuOpen, setAddElementMenuOpen] = useState(false)
  
  const pageMenuRef = useRef<HTMLDivElement>(null)
  const importExportMenuRef = useRef<HTMLDivElement>(null)
  const addElementMenuRef = useRef<HTMLDivElement>(null)
  const bulkCardDialogRef = useRef<BulkCardDialogRef>(null)

  const currentProject = projects.find(p => p.id === currentProjectId)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(event.target as Node)) {
        setPageMenuOpen(false)
      }
      if (importExportMenuRef.current && !importExportMenuRef.current.contains(event.target as Node)) {
        setImportExportMenuOpen(false)
      }
      if (addElementMenuRef.current && !addElementMenuRef.current.contains(event.target as Node)) {
        setAddElementMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAutoLayoutH = () => {
    window.dispatchEvent(new CustomEvent('auto-layout-h'))
  }

  const handleAutoLayoutV = () => {
    window.dispatchEvent(new CustomEvent('auto-layout-v'))
  }

  const handleToggleAllNumbers = () => {
    const { cards } = useCardStore.getState()
    const show = !cards.every(c => c.flags.showNumber)
    window.dispatchEvent(new CustomEvent('toggle-all-numbers', { detail: { show } }))
  }

  const handleToggleAllBody = () => {
    const { cards } = useCardStore.getState()
    const show = !cards.every(c => !c.flags.hideBody)
    window.dispatchEvent(new CustomEvent('toggle-all-body', { detail: { show } }))
  }

  const handleExportPNG = () => {
    window.dispatchEvent(new CustomEvent('export-png'))
  }

  const handlePrint = () => {
    window.dispatchEvent(new CustomEvent('print'))
  }

  return (
    <>
      <div className="top-toolbar">
        <button 
          onClick={() => { 
            if (onGoToProjectManager) onGoToProjectManager()
            useProjectStore.setState({ currentProjectId: null })
            usePageStore.setState({ currentPageId: null, pages: [] })
            useCardStore.setState({ cards: [] })
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          title="返回项目列表"
        >
          <ChevronLeft size={16} />
          <Home size={16} />
        </button>
        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <select
            value={pageId || ''}
            onChange={(e) => {
              const selectedPageId = e.target.value
              usePageStore.getState().setCurrentPage(selectedPageId)
              window.dispatchEvent(new CustomEvent('scroll-to-page', { detail: { pageId: selectedPageId } }))
            }}
            style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', minWidth: '72px' }}
          >
            {pages.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="toolbar-divider" />

        {/* 页面管理下拉菜单 */}
        <div className="dropdown" ref={pageMenuRef}>
          <button onClick={() => setPageMenuOpen(!pageMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FilePlus size={16} />
            页面管理
            <ChevronDown size={14} />
          </button>
          {pageMenuOpen && (
            <div className="dropdown-menu">
              <button onClick={() => {
                if (currentProjectId) createPage(currentProjectId)
                setPageMenuOpen(false)
              }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FilePlus size={16} />
                新建页面
              </button>
              <button onClick={() => {
                if (pageId && pages.length > 1) {
                  const sorted = [...pages].sort((a, b) => a.order - b.order)
                  const pageNum = sorted.findIndex(p => p.id === pageId) + 1
                  if (confirm(`确定删除第 ${pageNum} 页？此页面上的卡片和元素将被一并删除。`)) {
                    deletePage(pageId)
                  }
                }
                setPageMenuOpen(false)
              }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={16} />
                删除页面
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <button onClick={handleAutoLayoutH} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} />
            横向排版
          </button>
          <button onClick={handleAutoLayoutV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Columns size={16} />
          竖向排版
        </button>
        </div>

        <div className="toolbar-divider" />

        {/* 导入导出下拉菜单 */}
        <div className="dropdown" ref={importExportMenuRef}>
          <button onClick={() => setImportExportMenuOpen(!importExportMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Download size={16} />
            导入导出
            <ChevronDown size={14} />
          </button>
          {importExportMenuOpen && (
            <div className="dropdown-menu">
              <button onClick={() => {
                bulkCardDialogRef.current?.openImport()
                setImportExportMenuOpen(false)
              }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={16} />
                批量导入
              </button>
              <button onClick={() => {
                bulkCardDialogRef.current?.openExport()
                setImportExportMenuOpen(false)
              }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={16} />
                批量导出
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <button onClick={handleToggleAllNumbers} title="切换所有卡片编号显示" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <List size={16} />
            编号
          </button>
          <button onClick={handleToggleAllBody} title="切换所有卡片正文显示" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Type size={16} />
            正文
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* 添加元素下拉菜单 */}
        <div className="dropdown" ref={addElementMenuRef}>
          <button onClick={() => setAddElementMenuOpen(!addElementMenuOpen)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={16} />
            添加元素
            <ChevronDown size={14} />
          </button>
          {addElementMenuOpen && (
            <div className="dropdown-menu">
              <button onClick={() => {
                usePageElementStore.getState().setActiveTool(activeTool === 'text' ? null : 'text')
                setAddElementMenuOpen(false)
              }} className={activeTool === 'text' ? 'active' : ''} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Type size={16} />
                文本
              </button>
              <button onClick={() => {
                usePageElementStore.getState().setActiveTool(activeTool === 'arrow' ? null : 'arrow')
                setAddElementMenuOpen(false)
              }} className={activeTool === 'arrow' ? 'active' : ''} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowRight size={16} />
                箭头
              </button>
              <button onClick={() => {
                usePageElementStore.getState().setActiveTool(activeTool === 'red-box' ? null : 'red-box')
                setAddElementMenuOpen(false)
              }} className={activeTool === 'red-box' ? 'active' : ''} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Square size={16} />
                方框
              </button>
              <button onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = async (evt) => {
                    const dataUrl = evt.target?.result as string
                    const { currentPageId: storePageId } = usePageStore.getState()
                    if (!storePageId) return
                    const img = new window.Image()
                    img.onload = async () => {
                      const el = await usePageElementStore.getState().addElement(storePageId, 'image', { x: 20, y: 20 })
                      const wMm = Math.round(img.width / PX_PER_MM * 10) / 10
                      const hMm = Math.round(img.height / PX_PER_MM * 10) / 10
                      usePageElementStore.getState().updateElement(el.id, { content: { src: dataUrl }, size: { width: wMm, height: hMm } })
                    }
                    img.src = dataUrl
                  }
                  reader.readAsDataURL(file)
                }
                input.click()
                setAddElementMenuOpen(false)
              }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} />
                图片
              </button>
              <button onClick={async () => {
                try {
                  const clipboardItems = await navigator.clipboard.read()
                  for (const item of clipboardItems) {
                    const imageTypes = item.types.filter(t => t.startsWith('image/'))
                    if (imageTypes.length > 0) {
                      const blob = await item.getType(imageTypes[0])
                      const reader = new FileReader()
                      reader.onload = async (evt) => {
                        const dataUrl = evt.target?.result as string
                        const { currentPageId: storePageId } = usePageStore.getState()
                        if (!storePageId) return
                        const img = new window.Image()
                        img.onload = async () => {
                          const el = await usePageElementStore.getState().addElement(storePageId, 'image', { x: 20, y: 20 })
                          const wMm = Math.round(img.width / PX_PER_MM * 10) / 10
                          const hMm = Math.round(img.height / PX_PER_MM * 10) / 10
                          usePageElementStore.getState().updateElement(el.id, { content: { src: dataUrl }, size: { width: wMm, height: hMm } })
                        }
                        img.src = dataUrl
                      }
                      reader.readAsDataURL(blob)
                      return
                    }
                  }
                  alert('剪切板中没有图片')
                } catch {
                  alert('无法读取剪切板，请尝试使用 Ctrl+V 粘贴')
                }
                setAddElementMenuOpen(false)
              }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clipboard size={16} />
                粘贴图片
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <button onClick={() => useCanvasStore.getState().resetView()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} />
            重置视图
          </button>
          <button onClick={() => { window.dispatchEvent(new CustomEvent('zoom-to-fit')) }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="适应窗口">
            <Maximize2 size={16} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{Math.round(zoom * 100)}%</span>
        </div>

        <div style={{ flex: 1 }} />

        <div className="toolbar-section">
          <button onClick={handleExportPNG} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} />
            导出PNG
          </button>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} />
            打印
          </button>
        </div>
      </div>
      <BulkCardDialog ref={bulkCardDialogRef} showButtons={false} />
    </>
  )
}
