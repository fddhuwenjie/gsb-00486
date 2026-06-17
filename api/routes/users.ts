import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUserIdFromHeader, buildRecipeFromRow } from '../utils.js';
import type { UserProfile } from '../../shared/types.js';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入用户名和密码' });
    return;
  }
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  
  if (!user || user.password !== password) {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
    return;
  }
  
  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
    },
  });
});

router.get('/profile/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }
  
  const recipeCount = db.prepare('SELECT COUNT(*) as count FROM recipes WHERE author_id = ?').get(id).count;
  const followerCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(id).count;
  const followingCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(id).count;
  
  let isFollowing = false;
  if (currentUserId) {
    const follow = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, id);
    isFollowing = !!follow;
  }
  
  const profile: UserProfile = {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    recipeCount,
    followerCount,
    followingCount,
    isFollowing,
  };
  
  res.json({
    success: true,
    data: profile,
  });
});

router.get('/profile/:id/recipes', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  
  const rows = db.prepare('SELECT * FROM recipes WHERE author_id = ? ORDER BY created_at DESC').all(id) as any[];
  const recipes = rows.map(row => buildRecipeFromRow(row, currentUserId));
  
  res.json({
    success: true,
    data: recipes,
  });
});

router.get('/profile/:id/favorites', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  
  const rows = db.prepare(`
    SELECT r.* FROM recipes r
    INNER JOIN favorites f ON r.id = f.recipe_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(id) as any[];
  
  const recipes = rows.map(row => buildRecipeFromRow(row, currentUserId));
  
  res.json({
    success: true,
    data: recipes,
  });
});

router.post('/follow/:id', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { id } = req.params;
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  if (currentUserId === parseInt(id, 10)) {
    res.status(400).json({ success: false, error: '不能关注自己' });
    return;
  }
  
  const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, id);
  
  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(currentUserId, id);
    res.json({ success: true, data: { isFollowing: false } });
  } else {
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(currentUserId, id);
    res.json({ success: true, data: { isFollowing: true } });
  }
});

router.post('/favorite/:id', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { id } = req.params;
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?').get(currentUserId, id);
  
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?').run(currentUserId, id);
    res.json({ success: true, data: { isFavorite: false } });
  } else {
    db.prepare('INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)').run(currentUserId, id);
    res.json({ success: true, data: { isFavorite: true } });
  }
});

router.get('/profile/:id/following', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  const rows = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.bio,
      (SELECT COUNT(*) FROM recipes WHERE author_id = u.id) as recipeCount,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followerCount,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as followingCount
    FROM users u
    INNER JOIN follows f ON f.following_id = u.id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
  `).all(id) as any[];

  const profiles: UserProfile[] = rows.map(row => {
    let isFollowing = false;
    if (currentUserId) {
      const follow = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, row.id);
      isFollowing = !!follow;
    }
    return {
      id: row.id,
      username: row.username,
      avatar: row.avatar,
      bio: row.bio || '',
      recipeCount: row.recipeCount,
      followerCount: row.followerCount,
      followingCount: row.followingCount,
      isFollowing,
    };
  });

  res.json({ success: true, data: profiles });
});

router.get('/profile/:id/followers', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  const rows = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.bio,
      (SELECT COUNT(*) FROM recipes WHERE author_id = u.id) as recipeCount,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followerCount,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as followingCount
    FROM users u
    INNER JOIN follows f ON f.follower_id = u.id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
  `).all(id) as any[];

  const profiles: UserProfile[] = rows.map(row => {
    let isFollowing = false;
    if (currentUserId) {
      const follow = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, row.id);
      isFollowing = !!follow;
    }
    return {
      id: row.id,
      username: row.username,
      avatar: row.avatar,
      bio: row.bio || '',
      recipeCount: row.recipeCount,
      followerCount: row.followerCount,
      followingCount: row.followingCount,
      isFollowing,
    };
  });

  res.json({ success: true, data: profiles });
});

router.post('/reviews', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const { recipeId, rating, comment } = req.body;
  
  if (!recipeId || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ success: false, error: '评分必须在1-5之间' });
    return;
  }
  
  const existing = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND recipe_id = ?').get(currentUserId, recipeId);
  
  if (existing) {
    db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE id = ?').run(rating, comment || '', existing.id);
  } else {
    db.prepare('INSERT INTO reviews (user_id, recipe_id, rating, comment) VALUES (?, ?, ?, ?)').run(currentUserId, recipeId, rating, comment || '');
  }
  
  const stats = db.prepare(`
    SELECT AVG(rating) as avgRating, COUNT(*) as count 
    FROM reviews WHERE recipe_id = ?
  `).get(recipeId) as any;
  
  db.prepare('UPDATE recipes SET rating = ?, rating_count = ? WHERE id = ?').run(
    stats.avgRating || 0,
    stats.count || 0,
    recipeId
  );
  
  res.json({
    success: true,
    data: { rating: stats.avgRating || 0, ratingCount: stats.count || 0 },
  });
});

router.get('/reviews/:recipeId', (req: Request, res: Response) => {
  const { recipeId } = req.params;
  
  const rows = db.prepare(`
    SELECT r.*, u.username, u.avatar
    FROM reviews r
    INNER JOIN users u ON r.user_id = u.id
    WHERE r.recipe_id = ?
    ORDER BY r.created_at DESC
  `).all(recipeId) as any[];
  
  const reviews = rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    recipeId: row.recipe_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username,
      avatar: row.avatar,
    },
  }));
  
  res.json({
    success: true,
    data: reviews,
  });
});

export default router;
