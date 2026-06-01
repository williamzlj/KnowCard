import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../stores'
import { ContentLibraryDialog } from '../card/ContentLibraryDialog'
import { exportDatabase, importDatabase, resetDatabase } from '../../db/backup'
import { ChevronLeft, Plus, Upload, FolderOpen, Download, Database, Trash2 } from 'lucide-react'

interface ProjectManagerProps {
  onBack?: () => void
}

export function ProjectManager({ onBack }: ProjectManagerProps) {
  const { projects, createProject, renameProject, duplicateProject, deleteProject, setCurrentProject, exportProject, importProject, loadProjects } = useProjectStore()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [contentLibOpen, setContentLibOpen] = useState(false)
  const dbFileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="project-manager">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {onBack && (
          <button 
            onClick={onBack}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              padding: '8px 16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'white',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            <ChevronLeft size={18} />
            返回
          </button>
        )}
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
        <button className="import-btn" onClick={() => setContentLibOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen size={16} />
          资料库
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
        }} style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trash2 size={16} />
          重置数据库
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

      {projects.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', marginTop: 40 }}>
          暂无项目，请创建一个新项目开始使用
        </div>
      ) : (
        <div className="project-grid">
          {projects.map(project => (
            <div key={project.id} className="project-card" onClick={() => setCurrentProject(project.id)}>
              {editingId === project.id ? (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(project.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(project.id)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--accent-color)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}
                />
              ) : (
                <h3>{project.name}</h3>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                创建于 {new Date(project.createdAt).toLocaleDateString()}
              </div>
              <div className="actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setEditingId(project.id); setEditingName(project.name) }} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>重命名</button>
                <button onClick={() => duplicateProject(project.id)} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>复制</button>
                <button onClick={() => handleExport(project.id)} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>导出</button>
                <button onClick={() => { if (confirm('确定删除此项目？此操作不可恢复。')) deleteProject(project.id) }} style={{ padding: '4px 8px', background: 'var(--danger-color)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>删除</button>
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
    </div>
  )
}
