import { useEffect, useState } from 'react'
import { useProjectStore, usePageStore, useCardStore } from './stores'
import { TopToolbar } from './components/layout/TopToolbar'
import { BottomStatusBar } from './components/layout/BottomStatusBar'
import { CardListPanel } from './components/card/CardListPanel'
import { CanvasView } from './components/canvas/CanvasView'
import { PropertyPanel } from './components/properties/PropertyPanel'
import { ProjectManager } from './components/project/ProjectManager'
import { EditorModal } from './components/editor/EditorModal'
import { LoginPage } from './components/auth/LoginPage'
import { UserSettingsPage } from './components/auth/UserSettingsPage'
import { UserManagementPage } from './components/auth/UserManagementPage'
import { useEditorStore } from './stores/useEditorStore'
import { useAuthStore } from './stores/useAuthStore'
import './App.css'

type AppView = 'login' | 'main' | 'project-manager' | 'user-settings' | 'user-management'

export default function App() {
  const { projects, currentProjectId, loadProjects } = useProjectStore()
  const { currentPageId, loadPages } = usePageStore()
  const { loadCards, loadCardGroups } = useCardStore()
  const { isOpen: isEditorOpen } = useEditorStore()
  const { currentUser } = useAuthStore()
  const [view, setView] = useState<AppView>('login')

  useEffect(() => {
    if (currentUser) {
      setView('main')
      loadProjects()
    }
  }, [currentUser, loadProjects])

  useEffect(() => {
    if (currentProjectId) {
      loadPages(currentProjectId)
      loadCards(currentProjectId)
      loadCardGroups(currentProjectId)
      setView('main')
    }
  }, [currentProjectId, loadPages, loadCards, loadCardGroups])

  const handleLoginSuccess = () => {
    setView('main')
  }

  const handleLogout = () => {
    useAuthStore.getState().logout()
    setView('login')
  }

  const handleGoToProjectManager = () => {
    setView('project-manager')
  }

  const handleGoBack = () => {
    setView('main')
  }

  const handleGoToSettings = () => {
    setView('user-settings')
  }

  const handleGoToUserManagement = () => {
    setView('user-management')
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  if (view === 'user-settings') {
    return <UserSettingsPage onBack={handleGoBack} />
  }

  if (view === 'user-management') {
    return <UserManagementPage onBack={handleGoBack} />
  }

  if (view === 'project-manager') {
    return (
      <div>
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000, display: 'flex', gap: 8 }}>
          <UserNav 
            onGoToSettings={handleGoToSettings}
            onGoToUserManagement={handleGoToUserManagement}
            onLogout={handleLogout}
            currentUser={currentUser}
          />
        </div>
        <ProjectManager />
      </div>
    )
  }

  const shouldShowProjectManager = projects.length === 0 || !currentPageId

  if (shouldShowProjectManager) {
    return (
      <div>
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000, display: 'flex', gap: 8 }}>
          <UserNav 
            onGoToSettings={handleGoToSettings}
            onGoToUserManagement={handleGoToUserManagement}
            onLogout={handleLogout}
            currentUser={currentUser}
          />
        </div>
        <ProjectManager />
      </div>
    )
  }

  return (
    <div className="app-layout">
      <TopToolbar 
        onGoToProjectManager={handleGoToProjectManager}
        onGoToSettings={handleGoToSettings}
        onGoToUserManagement={handleGoToUserManagement}
        onLogout={handleLogout}
      />
      <div className="app-body">
        <CardListPanel />
        <CanvasView />
        <PropertyPanel />
      </div>
      <BottomStatusBar />
      {isEditorOpen && <EditorModal />}
    </div>
  )
}

interface UserNavProps {
  onGoToSettings: () => void
  onGoToUserManagement: () => void
  onLogout: () => void
  currentUser: any
}

function UserNav({ onGoToSettings, onGoToUserManagement, onLogout, currentUser }: UserNavProps) {
  const [showMenu, setShowMenu] = useState(false)
  
  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setShowMenu(!showMenu)}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          background: 'white',
          border: '1px solid #e5e7eb',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '12px'
        }}>
          {currentUser.username.charAt(0).toUpperCase()}
        </div>
        {currentUser.username}
      </button>
      {showMenu && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          padding: '8px',
          minWidth: '180px',
          zIndex: 1001
        }} onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => { setShowMenu(false); onGoToSettings(); }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              borderRadius: '8px',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <span style={{ fontSize: '16px' }}>⚙️</span> 账户设置
          </button>
          {currentUser.isAdmin && (
            <button 
              onClick={() => { setShowMenu(false); onGoToUserManagement(); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '8px',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: '16px' }}>👥</span> 用户管理
            </button>
          )}
          <div style={{ height: '1px', background: '#e5e7eb', margin: '6px 0' }}></div>
          <button 
            onClick={() => { setShowMenu(false); onLogout(); }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              borderRadius: '8px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <span style={{ fontSize: '16px' }}>🚪</span> 退出登录
          </button>
        </div>
      )}
    </div>
  )
}
