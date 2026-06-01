import { useState, useEffect } from 'react'
import { loginUser, registerUser, ensureAdminUser } from '../../db/auth'
import { useAuthStore } from '../../stores/useAuthStore'
import { Lock, User, UserPlus, Key, ArrowRight } from 'lucide-react'
import './Auth.css'

function KnowCardLogo() {
  return (
    <div className="knowcard-logo">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#667eea" />
        <path d="M16 14L16 34" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M16 24L30 14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M16 24L30 34" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="knowcard-name">KnowCard</span>
    </div>
  )
}

export function LoginPage({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setCurrentUser } = useAuthStore()

  useEffect(() => {
    ensureAdminUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const user = await loginUser(username, password)
        setCurrentUser(user)
        onLoginSuccess()
      } else {
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致')
          return
        }
        if (password.length < 6) {
          setError('密码至少需要6位')
          return
        }
        await registerUser(username, password, false)
        alert('注册成功，请登录')
        setMode('login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <KnowCardLogo />
        <h1 className="auth-title">
          {mode === 'login' ? '用户登录' : '用户注册'}
        </h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              <User size={18} /> 用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div className="form-group">
            <label>
              <Lock size={18} /> 密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          {mode === 'register' && (
            <div className="form-group">
              <label>
                <Key size={18} /> 确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                required
              />
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button onClick={() => setMode('register')} className="switch-button">
                <UserPlus size={14} /> 立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button onClick={() => setMode('login')} className="switch-button">
                立即登录
              </button>
            </>
          )}
        </div>
        <div className="auth-hint">
          <h3 className="auth-hint-title">📚 知识卡片智能排版工具</h3>
          <p className="auth-hint-text">
            一款专注于知识卡片制作与排版的工具。支持批量创建卡片、自动排版、卡片样式自定义、数学公式渲染等功能，帮助您高效制作美观的知识卡片。
          </p>
        </div>
        <div className="auth-data-warning">
          <p>⚠️ 本软件数据全部保存在用户浏览器管理的indexedDB数据库，服务器端不存储任何用户数据，请及时备份和保存。</p>
        </div>
        <div className="auth-author">
          <p>本软件由 张亮军 开发</p>
          <p>张亮数理化 无锡海岸城</p>
        </div>
      </div>
    </div>
  )
}
