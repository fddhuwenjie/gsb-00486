import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUserIdFromHeader } from '../utils.js';

const router = Router();

router.get('/recipe/:recipeId', (req: Request, res: Response) => {
  const { recipeId } = req.params;
  const { lang } = req.query;

  const recipe = db.prepare('SELECT id, title FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }

  if (lang) {
    const row = db.prepare(`
      SELECT id, recipe_id, language_code, translated_title, translated_steps, created_at, updated_at
      FROM recipe_translations
      WHERE recipe_id = ? AND language_code = ?
    `).get(recipeId, lang) as any;

    if (!row) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    const translation = {
      id: row.id,
      recipeId: row.recipe_id,
      languageCode: row.language_code,
      translatedTitle: row.translated_title,
      translatedSteps: JSON.parse(row.translated_steps || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({
      success: true,
      data: translation,
    });
  } else {
    const rows = db.prepare(`
      SELECT id, recipe_id, language_code, translated_title, created_at, updated_at
      FROM recipe_translations
      WHERE recipe_id = ?
      ORDER BY language_code
    `).all(recipeId) as any[];

    const translations = rows.map(row => ({
      id: row.id,
      recipeId: row.recipe_id,
      languageCode: row.language_code,
      translatedTitle: row.translated_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      success: true,
      data: translations,
    });
  }
});

router.post('/recipe/:recipeId', (req: Request, res: Response) => {
  const { recipeId } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  const { languageCode, translatedTitle, translatedSteps } = req.body;

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const recipe = db.prepare('SELECT author_id FROM recipes WHERE id = ?').get(recipeId) as any;
  if (!recipe) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }

  if (recipe.author_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限添加翻译' });
    return;
  }

  if (!languageCode || !translatedTitle) {
    res.status(400).json({ success: false, error: '请提供语言代码和翻译标题' });
    return;
  }

  try {
    const result = db.prepare(`
      INSERT INTO recipe_translations (recipe_id, language_code, translated_title, translated_steps)
      VALUES (?, ?, ?, ?)
    `).run(
      recipeId,
      languageCode,
      translatedTitle,
      JSON.stringify(translatedSteps || [])
    );

    const newTranslation = {
      id: Number(result.lastInsertRowid),
      recipeId: Number(recipeId),
      languageCode,
      translatedTitle,
      translatedSteps: translatedSteps || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: newTranslation,
    });
  } catch {
    res.status(400).json({ success: false, error: '该语言的翻译已存在' });
  }
});

router.put('/recipe/:recipeId/:lang', (req: Request, res: Response) => {
  const { recipeId, lang } = req.params;
  const currentUserId = getUserIdFromHeader(req);
  const { translatedTitle, translatedSteps } = req.body;

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const recipe = db.prepare('SELECT author_id FROM recipes WHERE id = ?').get(recipeId) as any;
  if (!recipe) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }

  if (recipe.author_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限修改翻译' });
    return;
  }

  const existing = db.prepare(
    'SELECT id FROM recipe_translations WHERE recipe_id = ? AND language_code = ?'
  ).get(recipeId, lang);

  if (!existing) {
    res.status(404).json({ success: false, error: '翻译不存在' });
    return;
  }

  db.prepare(`
    UPDATE recipe_translations
    SET translated_title = ?, translated_steps = ?, updated_at = CURRENT_TIMESTAMP
    WHERE recipe_id = ? AND language_code = ?
  `).run(
    translatedTitle !== undefined ? translatedTitle : existing.translated_title,
    translatedSteps !== undefined ? JSON.stringify(translatedSteps) : existing.translated_steps,
    recipeId,
    lang
  );

  res.json({
    success: true,
    message: '更新成功',
  });
});

router.delete('/recipe/:recipeId/:lang', (req: Request, res: Response) => {
  const { recipeId, lang } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const recipe = db.prepare('SELECT author_id FROM recipes WHERE id = ?').get(recipeId) as any;
  if (!recipe) {
    res.status(404).json({ success: false, error: '菜谱不存在' });
    return;
  }

  if (recipe.author_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限删除翻译' });
    return;
  }

  db.prepare('DELETE FROM recipe_translations WHERE recipe_id = ? AND language_code = ?').run(recipeId, lang);

  res.json({
    success: true,
    message: '删除成功',
  });
});

export default router;
