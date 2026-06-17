import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { buildRecipeFromRow, getUserIdFromHeader } from '../utils.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { category, tag, difficulty, sort, page = '1', limit = '12', search } = req.query;
  const currentUserId = getUserIdFromHeader(req);
  
  let whereClauses: string[] = [];
  let params: any[] = [];
  
  if (category) {
    whereClauses.push('r.category = ?');
    params.push(category);
  }
  
  if (difficulty) {
    whereClauses.push('r.difficulty = ?');
    params.push(difficulty);
  }
  
  if (tag) {
    whereClauses.push('r.id IN (SELECT recipe_id FROM recipe_tags WHERE tag = ?)');
    params.push(tag);
  }
  
  if (search) {
    whereClauses.push('r.title LIKE ?');
    params.push(`%${search}%`);
  }
  
  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  let orderSql = 'r.created_at DESC';
  if (sort === 'rating') {
    orderSql = 'r.rating DESC, r.rating_count DESC';
  } else if (sort === 'views') {
    orderSql = 'r.view_count DESC';
  } else if (sort === 'time') {
    orderSql = 'r.cook_time ASC';
  }
  
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;
  
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM recipes r ${whereSql}`).get(...params) as any;
  const total = countResult.total;
  
  const rows = db.prepare(`
    SELECT r.* FROM recipes r
    ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset) as any[];
  
  const recipes = rows.map(row => buildRecipeFromRow(row, currentUserId));
  
  res.json({
    success: true,
    data: {
      recipes,
      total,
      page: pageNum,
      limit: limitNum,
    },
  });
});

router.get('/categories', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT DISTINCT category FROM recipes').all() as any[];
  const categories = rows.map(r => r.category);
  
  res.json({
    success: true,
    data: categories,
  });
});

router.get('/tags', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT DISTINCT tag FROM recipe_tags').all() as any[];
  const tags = rows.map(r => r.tag);
  
  res.json({
    success: true,
    data: tags,
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as any;
  
  if (!row) {
    res.status(404).json({
      success: false,
      error: '菜谱不存在',
    });
    return;
  }
  
  db.prepare('UPDATE recipes SET view_count = view_count + 1 WHERE id = ?').run(id);
  
  if (currentUserId) {
    const existing = db.prepare('SELECT id FROM view_history WHERE user_id = ? AND recipe_id = ?').get(currentUserId, id);
    if (!existing) {
      db.prepare('INSERT INTO view_history (user_id, recipe_id) VALUES (?, ?)').run(currentUserId, id);
    }
  }
  
  const updatedRow = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  const recipe = buildRecipeFromRow(updatedRow, currentUserId);
  
  res.json({
    success: true,
    data: recipe,
  });
});

router.post('/', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const { title, category, difficulty, cookTime, servings, coverImage, ingredients, steps, tags } = req.body;
  
  if (!title || !category || !difficulty || !cookTime || !ingredients || !steps) {
    res.status(400).json({ success: false, error: '请填写完整信息' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO recipes (title, category, difficulty, cook_time, servings, cover_image, author_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, category, difficulty, cookTime, servings || 1, coverImage || '', currentUserId);
  
  const recipeId = Number(result.lastInsertRowid);
  
  const insertIngredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, sort_order) VALUES (?, ?, ?, ?, ?)');
  ingredients.forEach((ing: any, idx: number) => {
    insertIngredient.run(recipeId, ing.name, ing.amount, ing.unit, idx);
  });
  
  const insertStep = db.prepare('INSERT INTO recipe_steps (recipe_id, step_order, description, image_url) VALUES (?, ?, ?, ?)');
  steps.forEach((step: any) => {
    insertStep.run(recipeId, step.order, step.description, step.imageUrl || '');
  });
  
  const insertTag = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
  if (tags && tags.length > 0) {
    tags.forEach((tag: string) => {
      insertTag.run(recipeId, tag);
    });
  }
  
  const newRecipe = buildRecipeFromRow(db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId), currentUserId);
  
  db.prepare(`
    INSERT INTO recipe_versions (recipe_id, version_number, change_description, ingredients_snapshot, steps_snapshot)
    VALUES (?, 1, ?, ?, ?)
  `).run(
    recipeId,
    '初始版本',
    JSON.stringify(ingredients),
    JSON.stringify(steps)
  );
  
  res.json({
    success: true,
    data: newRecipe,
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  
  const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }
  
  if (existing.author_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限编辑' });
    return;
  }
  
  const { title, category, difficulty, cookTime, servings, coverImage, ingredients, steps, tags, changeDescription } = req.body;
  
  const oldIngredients = db.prepare(
    'SELECT name, amount, unit, sort_order FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order'
  ).all(id) as any[];
  const oldSteps = db.prepare(
    'SELECT step_order as "order", description, image_url as imageUrl FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order'
  ).all(id) as any[];
  
  db.prepare(`
    UPDATE recipes 
    SET title = ?, category = ?, difficulty = ?, cook_time = ?, servings = ?, cover_image = ?
    WHERE id = ?
  `).run(
    title || existing.title,
    category || existing.category,
    difficulty || existing.difficulty,
    cookTime || existing.cook_time,
    servings || existing.servings,
    coverImage !== undefined ? coverImage : existing.cover_image,
    id
  );
  
  if (ingredients) {
    db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
    const insertIngredient = db.prepare('INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, sort_order) VALUES (?, ?, ?, ?, ?)');
    ingredients.forEach((ing: any, idx: number) => {
      insertIngredient.run(id, ing.name, ing.amount, ing.unit, idx);
    });
  }
  
  if (steps) {
    db.prepare('DELETE FROM recipe_steps WHERE recipe_id = ?').run(id);
    const insertStep = db.prepare('INSERT INTO recipe_steps (recipe_id, step_order, description, image_url) VALUES (?, ?, ?, ?)');
    steps.forEach((step: any) => {
      insertStep.run(id, step.order, step.description, step.imageUrl || '');
    });
  }
  
  if (tags) {
    db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(id);
    const insertTag = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
    tags.forEach((tag: string) => {
      insertTag.run(id, tag);
    });
  }
  
  const maxVersionRow = db.prepare(
    'SELECT MAX(version_number) as max_version FROM recipe_versions WHERE recipe_id = ?'
  ).get(id) as any;
  const nextVersion = (maxVersionRow?.max_version || 0) + 1;
  
  const newIngredients = ingredients || oldIngredients;
  const newSteps = steps || oldSteps;
  
  db.prepare(`
    INSERT INTO recipe_versions (recipe_id, version_number, change_description, ingredients_snapshot, steps_snapshot)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    nextVersion,
    changeDescription || '更新菜谱',
    JSON.stringify(newIngredients),
    JSON.stringify(newSteps)
  );
  
  const updatedRecipe = buildRecipeFromRow(db.prepare('SELECT * FROM recipes WHERE id = ?').get(id), currentUserId);
  
  res.json({
    success: true,
    data: updatedRecipe,
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  
  const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }
  
  if (existing.author_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限删除' });
    return;
  }
  
  db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  
  res.json({
    success: true,
    message: '删除成功',
  });
});

export default router;
