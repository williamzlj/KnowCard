import { useState } from 'react'
import { updateUsername, updatePassword } from '../../db/auth'
import { useAuthStore } from '../../stores/useAuthStore'
import { User, Lock, ArrowLeft, Save, Check } from 'lucide-react'
import './Auth.css'

interface UserSettingsPageProps {
  onBack: () => void
}

export function UserSettingsPage({ onBack }: UserSettingsPageProps) {
  const { currentUser, setCurrentUser } = useAuthStore()
  const [username, setUsername] = useState(currentUser?.username || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  if (!currentUser) return null

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await updateUsername(currentUser.id, username)
      setCurrentUser({ ...currentUser, username })
      setSuccess('用户名更新成功')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmNewPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setError('密码至少需要6位')
      return
    }
    setLoading(true)
    try {
      await updatePassword(currentUser.id, newPassword)
      setOldPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setSuccess('密码更新成功')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="user-settings-page">
      <div className="user-settings-card">
        <div className="page-header">
          <button onClick={onBack} className="back-button">
            <ArrowLeft size={16} /> 返回
          </button>
          <h2>账户设置</h2>
          <div style={{ width: 80 }}></div>
        </div>

        {success && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: 12, borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={18} />
            {success}
          </div>
        )}
        {error && <div className="error-message" style={{ marginBottom: 20 }}>{error}</div>}

        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={20} />
            修改用户名
          </h3>
          <form onSubmit={handleUpdateUsername} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label>新用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入新用户名"
                required
              />
            </div>
            <button type="submit" className="save-button" disabled={loading} style={{ alignSelf: 'flex-start' }}>
              <Save size={16} />
              保存用户名
            </button>
          </form>
        </div>

        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={20} />
            修改密码
          </h3>
          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label>新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                required
              />
            </div>
            <div className="form-group">
              <label>确认新密码</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="请再次输入新密码"
                required
              />
            </div>
            <button type="submit" className="save-button" disabled={loading} style={{ alignSelf: 'flex-start' }}>
              <Save size={16} />
              更新密码
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
