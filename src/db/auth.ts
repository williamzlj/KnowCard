import { db, type User } from './database'
import { v4 as uuid } from 'uuid'

const SALT = 'knowcard-salt-2025'

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + SALT)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function registerUser(username: string, password: string, isAdmin: boolean = false): Promise<User> {
  const existing = await db.users.where('username').equalsIgnoreCase(username).first()
  if (existing) {
    throw new Error('用户名已存在')
  }
  const passwordHash = await hashPassword(password)
  const now = Date.now()
  const user: User = {
    id: uuid(),
    username,
    passwordHash,
    isAdmin,
    createdAt: now,
    updatedAt: now,
  }
  await db.users.add(user)
  return user
}

export async function loginUser(username: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password)
  const user = await db.users.where({ username, passwordHash }).first()
  if (!user) {
    throw new Error('用户名或密码错误')
  }
  return user
}

export async function updateUsername(userId: string, newUsername: string): Promise<void> {
  const existing = await db.users.where('username').equalsIgnoreCase(newUsername).first()
  if (existing && existing.id !== userId) {
    throw new Error('用户名已存在')
  }
  await db.users.update(userId, { username: newUsername, updatedAt: Date.now() })
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword)
  await db.users.update(userId, { passwordHash, updatedAt: Date.now() })
}

export async function getAllUsers(): Promise<User[]> {
  return await db.users.orderBy('createdAt').toArray()
}

export async function deleteUser(userId: string): Promise<void> {
  await db.users.delete(userId)
}

export async function updateUserRole(userId: string, isAdmin: boolean): Promise<void> {
  await db.users.update(userId, { isAdmin, updatedAt: Date.now() })
}

export async function ensureAdminUser(): Promise<void> {
  const count = await db.users.count()
  if (count === 0) {
    await registerUser('admin', 'admin123', true)
  }
}
