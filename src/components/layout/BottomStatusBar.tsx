import { useCanvasStore, usePageStore, useCardStore, useProjectStore } from '../../stores'

export function BottomStatusBar() {
  const { zoom, zoomIn, zoomOut, setZoom } = useCanvasStore()
  const { currentPageId, pages } = usePageStore()
  const { cards } = useCardStore()
  const { projects, currentProjectId } = useProjectStore()

  const currentPage = pages.find(p => p.id === currentPageId)
  const currentPageCards = cards.filter(c => c.pageId === currentPageId)
  const currentProject = projects.find(p => p.id === currentProjectId)

  return (
    <div className="bottom-statusbar">
      <div className="statusbar-left">
        <span className="statusbar-project-name">{currentProject?.name || ''}</span>
        <span className="statusbar-separator">|</span>
        <span>页面: {currentPage?.name || '-'}</span>
        <span className="statusbar-separator">|</span>
        <span>卡片数: {currentPageCards.length}</span>
      </div>
      <div className="zoom-controls">
        <button onClick={zoomOut} style={{ fontSize: 16, padding: '0 6px' }}>−</button>
        <input
          type="range"
          min={10}
          max={500}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
        />
        <button onClick={zoomIn} style={{ fontSize: 16, padding: '0 6px' }}>+</button>
        <span style={{ minWidth: 45, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}
