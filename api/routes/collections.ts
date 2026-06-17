import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUserIdFromHeader, buildRecipeFromRow } from '../utils.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { creatorId } = req.query;

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (creatorId) {
    whereClauses.push('c.creator_id = ?');
    params.push(creatorId);
  } else {
    whereClauses.push('c.is_public = 1');
    if (currentUserId) {
      whereClauses[0] = '(c.is_public = 1 OR c.creator_id = ?)';
      params.push(currentUserId);
    }
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT c.*, u.username as creator_name, u.avatar as creator_avatar,
           (SELECT COUNT(*) FROM collection_recipes WHERE collection_id = c.id) as recipe_count
    FROM collections c
    JOIN users u ON c.creator_id = u.id
    ${whereSql}
    ORDER BY c.created_at DESC
  `).all(...params) as any[];

  const collections = rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    coverImage: row.cover_image,
    creator: {
      id: row.creator_id,
      username: row.creator_name,
      avatar: row.creator_avatar,
    },
    isPublic: !!row.is_public,
    recipeCount: row.recipe_count,
    createdAt: row.created_at,
  }));

  res.json({
    success: true,
    data: collections,
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  const row = db.prepare(`
    SELECT c.*, u.username as creator_name, u.avatar as creator_avatar,
           (SELECT COUNT(*) FROM collection_recipes WHERE collection_id = c.id) as recipe_count
    FROM collections c
    JOIN users u ON c.creator_id = u.id
    WHERE c.id = ?
  `).get(id) as any;

  if (!row) {
    res.status(404).json({ success: false, error: '合集不存在' });
    return;
  }

  if (!row.is_public && row.creator_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限访问' });
    return;
  }

  const recipesRows = db.prepare(`
    SELECT r.* FROM recipes r
    JOIN collection_recipes cr ON r.id = cr.recipe_id
    WHERE cr.collection_id = ?
    ORDER BY cr.sort_order ASC, cr.added_at ASC
  `).all(id) as any[];

  const recipes = recipesRows.map(r => buildRecipeFromRow(r, currentUserId));

  const collection = {
    id: row.id,
    name: row.name,
    description: row.description,
    coverImage: row.cover_image,
    creator: {
      id: row.creator_id,
      username: row.creator_name,
      avatar: row.creator_avatar,
    },
    isPublic: !!row.is_public,
    recipeCount: row.recipe_count,
    recipes,
    createdAt: row.created_at,
  };

  res.json({
    success: true,
    data: collection,
  });
});

router.post('/', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const { name, description, coverImage, isPublic } = req.body;

  if (!name) {
    res.status(400).json({ success: false, error: '请输入合集名称' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO collections (name, description, cover_image, creator_id, is_public)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    description || '',
    coverImage || '',
    currentUserId,
    isPublic !== false ? 1 : 0
  );

  const newCollection = {
    id: Number(result.lastInsertRowid),
    name,
    description: description || '',
    coverImage: coverImage || '',
    isPublic: isPublic !== false,
    createdAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: newCollection,
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  const existing = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ success: false, error: '合集不存在' });
    return;
  }

  if (existing.creator_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限编辑' });
    return;
  }

  const { name, description, coverImage, isPublic } = req.body;

  db.prepare(`
    UPDATE collections SET name = ?, description = ?, cover_image = ?, is_public = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    coverImage !== undefined ? coverImage : existing.cover_image,
    isPublic !== undefined ? (isPublic ? 1 : 0) : existing.is_public,
    id
  );

  res.json({
    success: true,
    message: '更新成功',
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  const existing = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ success: false, error: '合集不存在' });
    return;
  }

  if (existing.creator_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限删除' });
    return;
  }

  db.prepare('DELETE FROM collections WHERE id = ?').run(id);

  res.json({
    success: true,
    message: '删除成功',
  });
});

router.post('/:id/recipes', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  const { recipeId } = req.body;

  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as any;
  if (!collection) {
    res.status(404).json({ success: false, error: '合集不存在' });
    return;
  }

  if (collection.creator_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限操作' });
    return;
  }

  const recipe = db.prepare('SELECT id FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }

  try {
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM collection_recipes WHERE collection_id = ?'
    ).get(id) as any;

    db.prepare(`
      INSERT INTO collection_recipes (collection_id, recipe_id, sort_order)
      VALUES (?, ?, ?)
    `).run(id, recipeId, maxOrder.max_order + 1);

    res.json({
      success: true,
      message: '添加成功',
    });
  } catch {
    res.status(400).json({ success: false, error: '菜谱已在合集中' });
  }
});

router.delete('/:id/recipes/:recipeId', (req: Request, res: Response) => {
  const { id, recipeId } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as any;
  if (!collection) {
    res.status(404).json({ success: false, error: '合集不存在' });
    return;
  }

  if (collection.creator_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限操作' });
    return;
  }

  db.prepare('DELETE FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?').run(id, recipeId);

  res.json({
    success: true,
    message: '移除成功',
  });
});

export default router;
