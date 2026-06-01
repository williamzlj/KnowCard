import { useCallback, useMemo } from 'react'
import { useCardStore, usePageStore, useProjectStore } from '../../stores'
import { useEditorStore } from '../../stores/useEditorStore'
import { usePageElementStore } from '../../stores/usePageElementStore'
import { extractPlainText } from '../../utils/richText'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableCardItem({ card, cardNumber, isSelected, onToggle, onSelect, onDoubleClick }: {
  card: { id: string; title: string; content: Record<string, unknown>; flags: { excludeFromNumbering: boolean } }
  cardNumber: number
  isSelected: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onDoubleClick: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const bodyPreview = extractPlainText(card.content)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-list-item ${isSelected ? 'selected' : ''}`}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          onToggle(card.id)
        } else {
          onSelect(card.id)
        }
      }}
      onDoubleClick={() => onDoubleClick(card.id)}
    >
      <div {...attributes} {...listeners} style={{ cursor: 'grab', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>⠿</span>
        {!card.flags.excludeFromNumbering && (
          <span className="card-number">{cardNumber}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="card-title" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>{card.title || '(无标题)'}</span>
        {bodyPreview && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1, lineHeight: 1.3 }}>
            {bodyPreview}
          </div>
        )}
      </div>
    </div>
  )
}

export function CardListPanel() {
  const { cards, selectedCardIds, searchQuery, toggleCardSelection, selectAllCards, clearSelection, setSearchQuery, createCard, duplicateCard } = useCardStore()
  const { pages, currentPageId } = usePageStore()
  const { openCardEditor } = useEditorStore()

  const globalKeyMap = useMemo(() => {
    const map = new Map<string, number>()
    let gnum = 1
    const allSorted = [...pages]
      .sort((a, b) => a.order - b.order)
      .flatMap(page => cards.filter(c => c.pageId === page.id).sort((a, b) => a.order - b.order))
    for (const c of allSorted) {
      if (!c.flags.excludeFromNumbering) map.set(c.id, gnum++)
    }
    return map
  }, [pages, cards])

  const pageCards = cards
    .filter(c => c.pageId === currentPageId)
    .sort((a, b) => a.order - b.order)
    .filter(c => !searchQuery || c.title.includes(searchQuery) || JSON.stringify(c.content).includes(searchQuery))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pageCards.findIndex(c => c.id === active.id)
    const newIndex = pageCards.findIndex(c => c.id === over.id)

    const newOrder = arrayMove(pageCards, oldIndex, newIndex)
    useCardStore.getState().reorderCards(newOrder.map(c => c.id))
  }, [pageCards])

  const handleCreateCard = async () => {
    const { currentProjectId } = useProjectStore.getState()
    const { currentPageId } = usePageStore.getState()
    if (!currentProjectId || !currentPageId) return
    const card = await createCard(currentProjectId, currentPageId)
    openCardEditor(card.id)
  }

  return (
    <div className="left-panel">
      <div className="panel-header">
        <button onClick={handleCreateCard} style={{ padding: '6px', background: 'var(--accent-color)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 6 }}>
          + 新建卡片
        </button>
        <input
          type="text"
          placeholder="搜索卡片..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 4, fontSize: 12 }}>
          <button onClick={selectAllCards} style={{ padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>全选</button>
          <button onClick={clearSelection} style={{ padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>取消选择</button>
          <button onClick={() => {
            if (selectedCardIds.length > 0 && currentPageId) {
              for (const id of selectedCardIds) {
                duplicateCard(id, currentPageId)
              }
            }
          }} style={{ padding: '2px 6px', background: 'var(--accent-color)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>复制选中</button>
          <button onClick={() => {
            if (selectedCardIds.length > 0 && confirm(`确定删除 ${selectedCardIds.length} 个卡片？`)) {
              useCardStore.getState().deleteCards(selectedCardIds)
            }
          }} style={{ padding: '2px 6px', background: 'var(--danger-color)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>删除选中</button>
        </div>
      </div>

      <div className="card-list">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pageCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {pageCards.map((card) => (
              <SortableCardItem
                key={card.id}
                card={card}
                cardNumber={globalKeyMap.get(card.id) ?? 1}
                isSelected={selectedCardIds.includes(card.id)}
                onToggle={toggleCardSelection}
                onSelect={(id) => {
                  useCardStore.setState({ selectedCardIds: [id] })
                  usePageElementStore.getState().clearSelection()
                }}
                onDoubleClick={(id) => openCardEditor(id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
