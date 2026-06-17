import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.post('/register', (req: Request, res: Response): void => {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入用户名和密码' })
    return
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as any
  if (existing) {
    res.status(400).json({ success: false, error: '用户名已存在' })
    return
  }

  const result = db.prepare(`
    INSERT INTO users (username, password, avatar, bio)
    VALUES (?, ?, ?, ?)
  `).run(username, password, `https://i.pravatar.cc/150?u=${encodeURIComponent(username)}`, '')

  const user = db.prepare('SELECT id, username, avatar, bio FROM users WHERE id = ?').get(result.lastInsertRowid) as any

  res.json({
    success: true,
    data: user,
  })
})

router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入用户名和密码' })
    return
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any

  if (!user || user.password !== password) {
    res.status(401).json({ success: false, error: '用户名或密码错误' })
    return
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
    },
  })
})

router.get('/me', (req: Request, res: Response): void => {
  const userId = req.headers['x-user-id']
  if (!userId) {
    res.status(401).json({ success: false, error: '未登录' })
    return
  }

  const user = db.prepare('SELECT id, username, avatar, bio FROM users WHERE id = ?').get(userId) as any
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' })
    return
  }

  res.json({
    success: true,
    data: user,
  })
})

export default router
