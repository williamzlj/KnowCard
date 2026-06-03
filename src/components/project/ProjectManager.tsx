import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../stores'
import { ContentLibraryDialog } from '../card/ContentLibraryDialog'
import { ImageLibraryDialog } from '../card/ImageLibraryDialog'
import { RegexReplaceDialog } from '../card/RegexReplaceDialog'
import { exportDatabase, importDatabase, resetDatabase, exportUserSettings } from '../../db/backup'
import { Plus, Upload, FolderOpen, Download, Database, Trash2, ImageIcon, Braces, Pin, PinOff, GripVertical } from 'lucide-react'

interface ProjectManagerProps {
}

export function ProjectManager() {
  const { projects, createProject, renameProject, duplicateProject, deleteProject, setCurrentProject, exportProject, importProject, loadProjects, reorderProjects, togglePin } = useProjectStore()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [contentLibOpen, setContentLibOpen] = useState(false)
  const [imageLibOpen, setImageLibOpen] = useState(false)
  const [regexReplaceOpen, setRegexReplaceOpen] = useState(false)
  const dbFileInputRef = useRef<HTMLInputElement>(null)

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreate = async () => {
    const name = newName.trim() || '未命名项目'
    await createProject(name)
    setNewName('')
  }

  const handleRename = async (id: string) => {
    if (editingName.trim()) {
      await renameProject(id, editingName.trim())
    }
    setEditingId(null)
  }

  const handleExport = async (id: string) => {
    const blob = await exportProject(id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const name = projects.find(p => p.id === id)?.name || 'project'
    a.download = `KnowCard_${name}_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importProject(file)
    } catch {
      alert('导入失败：文件格式不正确')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newProjects = [...projects]
      const [draggedItem] = newProjects.splice(draggedIndex, 1)
      newProjects.splice(dragOverIndex, 0, draggedItem)
      reorderProjects(newProjects)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const toggleProjectSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedProjectIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedProjectIds(newSelected)
  }

  const selectAllProjects = () => {
    if (selectedProjectIds.size === projects.length) {
      setSelectedProjectIds(new Set())
    } else {
      setSelectedProjectIds(new Set(projects.map(p => p.id)))
    }
  }

  const handleBatchExport = async () => {
    if (selectedProjectIds.size === 0) {
      alert('请先选择要导出的项目')
      return
    }
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id))
    const allData = []
    for (const project of selectedProjects) {
      const blob = await exportProject(project.id)
      const text = await blob.text()
      const data = JSON.parse(text)
      allData.push(data)
    }
    const mergedData = {
      version: 2,
      type: 'multi-project',
      projects: allData,
      exportedAt: new Date().toISOString()
    }
    const mergedBlob = new Blob([JSON.stringify(mergedData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(mergedBlob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const names = selectedProjects.map(p => p.name).join('_')
    let displayNames = names
    if (names.length > 25) {
      displayNames = names.substring(0, 25) + `…等${selectedProjects.length}个文件`
    }
    a.download = `KnowCard_${displayNames}_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBatchDelete = async () => {
    if (selectedProjectIds.size === 0) {
      alert('请先选择要删除的项目')
      return
    }
    if (!confirm(`确定删除选中的 ${selectedProjectIds.size} 个项目？此操作不可恢复。`)) return
    for (const id of selectedProjectIds) {
      await deleteProject(id)
    }
    setSelectedProjectIds(new Set())
  }

  return (
    <div className="project-manager">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1>知识卡片智能排版工具</h1>
      </div>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="输入项目名称"
          style={{ padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: 15, width: 260 }}
        />
        <button className="create-btn" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} />
          创建项目
        </button>
        <button className="import-btn" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Upload size={16} />
          导入项目
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button className="import-btn" onClick={() => exportUserSettings()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={16} />
          导出用户设置
        </button>
        <button className="import-btn" onClick={() => exportDatabase()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={16} />
          导出数据库
        </button>
        <button className="import-btn" onClick={() => dbFileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Database size={16} />
          导入数据库
        </button>
        <button className="import-btn" onClick={async () => {
          if (!confirm('重置将先导出当前数据库备份，然后清空所有数据。确定继续？')) return
          const result = await resetDatabase()
          if (result.success) {
            alert('重置成功，页面将刷新')
            window.location.reload()
          } else {
            alert(result.error)
          }
        }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trash2 size={16} />
          重置数据库
        </button>
        <button className="import-btn" onClick={() => setRegexReplaceOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Braces size={16} />
          正则替换
        </button>
        <button className="import-btn" onClick={() => setContentLibOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen size={16} />
          资料库
        </button>
        <button className="import-btn" onClick={() => setImageLibOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ImageIcon size={16} />
          图片库
        </button>
        <input
          ref={dbFileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (!confirm('导入将覆盖当前所有数据，确定继续？')) return
            const result = await importDatabase(file)
            if (result.success) {
              alert('导入成功，页面将刷新')
              window.location.reload()
            } else {
              alert(result.error)
            }
            if (dbFileInputRef.current) dbFileInputRef.current.value = ''
          }}
        />
      </div>

      {selectedProjectIds.size > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="import-btn" onClick={selectAllProjects} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {selectedProjectIds.size === projects.length ? '取消全选' : '全选'}
          </button>
          <button className="create-btn" onClick={handleBatchExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} />
            导出选中 ({selectedProjectIds.size})
          </button>
          <button className="import-btn" onClick={handleBatchDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#dc2626' }}>
            <Trash2 size={16} />
            删除选中 ({selectedProjectIds.size})
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', marginTop: 40 }}>
          暂无项目，请创建一个新项目开始使用
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className={`project-card ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''} ${selectedProjectIds.has(project.id) ? 'selected' : ''}`}
              onClick={() => setCurrentProject(project.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.has(project.id)}
                    onChange={(e) => toggleProjectSelection(project.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer', width: 18, height: 18 }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(project.id)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                    title={project.isPinned ? '取消置顶' : '置顶'}
                  >
                    {project.isPinned ? <Pin size={16} color="red" /> : <PinOff size={16} />}
                  </button>
                  <div style={{ flex: 1 }}>
                    {editingId === project.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleRename(project.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(project.id)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--accent-color)', borderRadius: 'var(--radius-sm)' }}
                      />
                    ) : (
                      <h3 style={{ margin: 0 }}>{project.name}</h3>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                  <GripVertical size={16} style={{ cursor: 'grab', color: 'var(--text-muted)' }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                创建于 {new Date(project.createdAt).toLocaleDateString()}
              </div>
              <div className="actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setEditingId(project.id); setEditingName(project.name) }} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>重命名</button>
                <button onClick={() => duplicateProject(project.id)} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>复制</button>
                <button onClick={() => handleExport(project.id)} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>导出</button>
                <button onClick={() => { if (confirm('确定删除此项目？此操作不可恢复。')) deleteProject(project.id) }} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ContentLibraryDialog
        isOpen={contentLibOpen}
        onClose={() => setContentLibOpen(false)}
        onApply={() => {}}
        currentTitle=""
        currentContent={{ type: 'doc', content: [] }}
        standalone
      />
      <ImageLibraryDialog
        isOpen={imageLibOpen}
        onClose={() => setImageLibOpen(false)}
      />
      <RegexReplaceDialog
        isOpen={regexReplaceOpen}
        onClose={() => setRegexReplaceOpen(false)}
      />
    </div>
  )
}
