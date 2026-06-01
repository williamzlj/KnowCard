import { useState, useEffect } from 'react'
import { getAllUsers, deleteUser, updateUserRole, updatePassword } from '../../db/auth'
import type { User } from '../../db/database'
import { useAuthStore } from '../../stores/useAuthStore'
import { ArrowLeft, Users, Edit, Trash, Shield, Key, X, Check } from 'lucide-react'
import './Auth.css'

interface UserManagementPageProps {
  onBack: () => void
}

export function UserManagementPage({ onBack }: UserManagementPageProps) {
  const { currentUser } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const usersList = await getAllUsers()
    setUsers(usersList)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setNewUsername(user.username)
    setNewPassword('')
    setNewIsAdmin(user.isAdmin)
    setError('')
    setSuccess('')
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    setError('')
    setLoading(true)
    try {
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('密码至少需要6位')
        }
        await updatePassword(editingUser.id, newPassword)
      }
      await updateUserRole(editingUser.id, newIsAdmin)
      setSuccess('用户信息更新成功')
      setEditingUser(null)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('不能删除当前登录的用户')
      return
    }
    if (!confirm(`确定删除用户 "${user.username}"？`)) return
    try {
      await deleteUser(user.id)
      await loadUsers()
      setSuccess('用户已删除')
    } catch (err) {
      setError('删除失败')
    }
  }

  return (
    <div className="user-management-page">
      <div className="user-management-card">
        <div className="page-header">
          <button onClick={onBack} className="back-button">
            <ArrowLeft size={16} /> 返回
          </button>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={24} /> 用户管理
          </h2>
          <div style={{ width: 80 }}></div>
        </div>

        {success && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: 12, borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={18} />
            {success}
          </div>
        )}
        {error && <div className="error-message" style={{ marginBottom: 20 }}>{error}</div>}

        <div className="users-list">
          {users.map((user) => (
            <div key={user.id} className="user-item">
              <div className="user-info">
                <div className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{user.username}</strong>
                    {user.isAdmin && <span className="admin-badge"><Shield size={12} /> 管理员</span>}
                  </div>
                  <span>
                    注册于 {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="user-actions">
                <button onClick={() => handleEditUser(user)} className="edit-button">
                  <Edit size={14} /> 编辑
                </button>
                <button onClick={() => handleDeleteUser(user)} className="delete-button">
                  <Trash size={14} /> 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingUser && (
        <div className="edit-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>编辑用户</h3>
              <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={16} /> 用户名
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                disabled
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Key size={16} /> 新密码（留空则不修改）
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码"
              />
            </div>
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="isAdmin"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
              />
              <label htmlFor="isAdmin" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={14} /> 管理员权限
              </label>
            </div>
            {error && <div className="error-message" style={{ marginTop: 16 }}>{error}</div>}
            <div className="modal-actions">
              <button onClick={() => setEditingUser(null)} className="cancel-button">
                取消
              </button>
              <button onClick={handleSaveEdit} className="save-button" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function User({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
