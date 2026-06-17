import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUserIdFromHeader, buildRecipeFromRow } from '../utils.js';

const router = Router();

router.get('/recipe/:recipeId', (req: Request, res: Response) => {
  const { recipeId } = req.params;

  const recipe = db.prepare('SELECT id, title FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }

  const rows = db.prepare(`
    SELECT id, recipe_id, version_number, change_description, 
           ingredients_snapshot, steps_snapshot, created_at
    FROM recipe_versions
    WHERE recipe_id = ?
    ORDER BY version_number DESC
  `).all(recipeId) as any[];

  const versions = rows.map(row => ({
    id: row.id,
    recipeId: row.recipe_id,
    versionNumber: row.version_number,
    changeDescription: row.change_description,
    ingredientsSnapshot: JSON.parse(row.ingredients_snapshot),
    stepsSnapshot: JSON.parse(row.steps_snapshot),
    createdAt: row.created_at,
  }));

  res.json({
    success: true,
    data: versions,
  });
});

router.get('/recipe/:recipeId/:versionNumber', (req: Request, res: Response) => {
  const { recipeId, versionNumber } = req.params;

  const row = db.prepare(`
    SELECT id, recipe_id, version_number, change_description,
           ingredients_snapshot, steps_snapshot, created_at
    FROM recipe_versions
    WHERE recipe_id = ? AND version_number = ?
  `).get(recipeId, versionNumber) as any;

  if (!row) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }

  const version = {
    id: row.id,
    recipeId: row.recipe_id,
    versionNumber: row.version_number,
    changeDescription: row.change_description,
    ingredientsSnapshot: JSON.parse(row.ingredients_snapshot),
    stepsSnapshot: JSON.parse(row.steps_snapshot),
    createdAt: row.created_at,
  };

  res.json({
    success: true,
    data: version,
  });
});

router.post('/recipe/:recipeId/fork', (req: Request, res: Response) => {
  const { recipeId } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const originalRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as any;
  if (!originalRecipe) {
    res.status(404).json({ success: false, error: '原菜谱不存在' });
    return;
  }

  if (originalRecipe.author_id === currentUserId) {
    res.status(400).json({ success: false, error: '不能分叉自己的菜谱' });
    return;
  }

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (title, category, difficulty, cook_time, servings, cover_image, author_id, fork_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertRecipe.run(
    originalRecipe.title + '（改编版）',
    originalRecipe.category,
    originalRecipe.difficulty,
    originalRecipe.cook_time,
    originalRecipe.servings,
    originalRecipe.cover_image,
    currentUserId,
    recipeId
  );

  const newRecipeId = Number(result.lastInsertRowid);

  const ingredients = db.prepare(
    'SELECT name, amount, unit, sort_order FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order'
  ).all(recipeId) as any[];

  const steps = db.prepare(
    'SELECT step_order, description, image_url FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order'
  ).all(recipeId) as any[];

  const tags = db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ?').all(recipeId).map((t: any) => t.tag) as string[];

  const insertIngredient = db.prepare(
    'INSERT INTO recipe_ingredients (recipe_id, name, amount, unit, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  ingredients.forEach((ing: any) => {
    insertIngredient.run(newRecipeId, ing.name, ing.amount, ing.unit, ing.sort_order);
  });

  const insertStep = db.prepare(
    'INSERT INTO recipe_steps (recipe_id, step_order, description, image_url) VALUES (?, ?, ?, ?)'
  );
  steps.forEach((step: any) => {
    insertStep.run(newRecipeId, step.step_order, step.description, step.image_url);
  });

  const insertTag = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
  tags.forEach(tag => {
    insertTag.run(newRecipeId, tag);
  });

  const insertVersion = db.prepare(`
    INSERT INTO recipe_versions (recipe_id, version_number, change_description, ingredients_snapshot, steps_snapshot)
    VALUES (?, 1, ?, ?, ?)
  `);
  insertVersion.run(
    newRecipeId,
    `改编自 ${originalRecipe.title}`,
    JSON.stringify(ingredients.map((i: any) => ({ name: i.name, amount: i.amount, unit: i.unit }))),
    JSON.stringify(steps.map((s: any) => ({ order: s.step_order, description: s.description, imageUrl: s.image_url })))
  );

  const newRecipe = buildRecipeFromRow(
    db.prepare('SELECT * FROM recipes WHERE id = ?').get(newRecipeId),
    currentUserId
  );

  res.json({
    success: true,
    data: newRecipe,
  });
});

router.get('/fork-source/:recipeId', (req: Request, res: Response) => {
  const { recipeId } = req.params;

  const recipe = db.prepare('SELECT fork_from FROM recipes WHERE id = ?').get(recipeId) as any;
  if (!recipe || !recipe.fork_from) {
    res.json({ success: true, data: null });
    return;
  }

  const source = db.prepare(`
    SELECT r.id, r.title, r.cover_image, r.author_id, u.username, u.avatar
    FROM recipes r
    JOIN users u ON r.author_id = u.id
    WHERE r.id = ?
  `).get(recipe.fork_from) as any;

  if (!source) {
    res.json({ success: true, data: null });
    return;
  }

  res.json({
    success: true,
    data: {
      id: source.id,
      title: source.title,
      coverImage: source.cover_image,
      author: {
        id: source.author_id,
        username: source.username,
        avatar: source.avatar,
      },
    },
  });
});

export default router;
