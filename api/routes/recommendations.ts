import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { buildRecipeFromRow, getUserIdFromHeader } from '../utils.js';

const router = Router();

const SEASONAL_TAGS: Record<number, string[]> = {
  1: ['滋补', '暖身'],
  2: ['滋补', '暖身'],
  3: ['春日', '清淡'],
  4: ['春日', '清淡'],
  5: ['春日', '清淡'],
  6: ['解暑', '清凉'],
  7: ['解暑', '清凉', '减脂'],
  8: ['解暑', '清凉'],
  9: ['秋日', '滋补'],
  10: ['秋日', '滋补'],
  11: ['滋补', '暖身'],
  12: ['滋补', '暖身'],
};

const SEASONAL_CATEGORIES: Record<number, string[]> = {
  1: ['汤羹', '中餐'],
  2: ['汤羹', '中餐'],
  3: ['日料', '饮品'],
  4: ['日料', '西餐', '饮品'],
  5: ['饮品', '西餐'],
  6: ['饮品', '汤羹'],
  7: ['饮品', '汤羹'],
  8: ['饮品', '西餐'],
  9: ['汤羹', '中餐'],
  10: ['汤羹', '烘焙'],
  11: ['汤羹', '中餐', '烘焙'],
  12: ['汤羹', '烘焙'],
};

router.get('/personalized', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  
  if (!currentUserId) {
    const popularRecipes = db.prepare(`
      SELECT * FROM recipes 
      ORDER BY view_count DESC, rating DESC
      LIMIT 8
    `).all() as any[];
    
    const recipes = popularRecipes.map(row => buildRecipeFromRow(row, null));
    
    res.json({
      success: true,
      data: {
        recipes,
        reason: '热门推荐',
      },
    });
    return;
  }
  
  const favoriteTags = db.prepare(`
    SELECT DISTINCT rt.tag FROM recipe_tags rt
    INNER JOIN favorites f ON rt.recipe_id = f.recipe_id
    WHERE f.user_id = ?
  `).all(currentUserId).map((r: any) => r.tag);
  
  const viewHistoryTags = db.prepare(`
    SELECT DISTINCT rt.tag FROM recipe_tags rt
    INNER JOIN view_history vh ON rt.recipe_id = vh.recipe_id
    WHERE vh.user_id = ?
  `).all(currentUserId).map((r: any) => r.tag);
  
  const allTags = [...new Set([...favoriteTags, ...viewHistoryTags])];
  
  let recipes: any[] = [];
  
  if (allTags.length > 0) {
    const placeholders = allTags.map(() => '?').join(',');
    
    const rows = db.prepare(`
      SELECT r.*, COUNT(rt.tag) as tag_match_count
      FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${placeholders})
      AND r.id NOT IN (SELECT recipe_id FROM view_history WHERE user_id = ?)
      GROUP BY r.id
      ORDER BY tag_match_count DESC, r.rating DESC, r.view_count DESC
      LIMIT 12
    `).all(...allTags, currentUserId) as any[];
    
    recipes = rows.map(row => buildRecipeFromRow(row, currentUserId));
  }
  
  if (recipes.length < 6) {
    const existingIds = recipes.map(r => r.id);
    const placeholders = existingIds.length > 0 ? existingIds.map(() => '?').join(',') : '0';
    
    const moreRows = db.prepare(`
      SELECT * FROM recipes
      WHERE id NOT IN (${placeholders})
      ORDER BY rating DESC, view_count DESC
      LIMIT ${12 - recipes.length}
    `).all(...existingIds) as any[];
    
    const moreRecipes = moreRows.map(row => buildRecipeFromRow(row, currentUserId));
    recipes = [...recipes, ...moreRecipes];
  }
  
  res.json({
    success: true,
    data: {
      recipes: recipes.slice(0, 12),
      reason: allTags.length > 0 ? `基于你的口味推荐 (${allTags.slice(0, 3).join('、')})` : '为你推荐',
      userTags: allTags,
    },
  });
});

router.post('/by-ingredients', (req: Request, res: Response) => {
  const { ingredients } = req.body;
  const currentUserId = getUserIdFromHeader(req);
  
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    res.status(400).json({ success: false, error: '请输入食材' });
    return;
  }
  
  const placeholders = ingredients.map(() => '?').join(',');
  
  const rows = db.prepare(`
    SELECT r.*, COUNT(DISTINCT ri.name) as match_count,
    (SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id = r.id) as total_count
    FROM recipes r
    INNER JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    WHERE ri.name IN (${placeholders})
    GROUP BY r.id
    ORDER BY match_count DESC, total_count ASC, r.rating DESC
    LIMIT 12
  `).all(...ingredients) as any[];
  
  const recipes = rows.map(row => {
    const recipe = buildRecipeFromRow(row, currentUserId);
    const matchCount = row.match_count;
    const totalCount = row.total_count;
    const matchPercent = Math.round((matchCount / totalCount) * 100);
    
    return {
      ...recipe,
      matchCount,
      totalCount,
      matchPercent,
    };
  });
  
  res.json({
    success: true,
    data: {
      recipes,
      inputIngredients: ingredients,
    },
  });
});

router.get('/seasonal', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const currentMonth = new Date().getMonth() + 1;
  
  const seasonalCategories = SEASONAL_CATEGORIES[currentMonth] || [];
  const seasonalTags = SEASONAL_TAGS[currentMonth] || [];
  
  let rows: any[] = [];
  
  if (seasonalCategories.length > 0) {
    const placeholders = seasonalCategories.map(() => '?').join(',');
    rows = db.prepare(`
      SELECT r.* FROM recipes r
      WHERE r.category IN (${placeholders})
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT 10
    `).all(...seasonalCategories) as any[];
  } else {
    rows = db.prepare(`
      SELECT * FROM recipes
      ORDER BY rating DESC, view_count DESC
      LIMIT 10
    `).all() as any[];
  }
  
  const recipes = rows.map(row => buildRecipeFromRow(row, currentUserId));
  
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  
  res.json({
    success: true,
    data: {
      recipes,
      month: currentMonth,
      monthName: monthNames[currentMonth - 1],
      reason: `${monthNames[currentMonth - 1]}时令推荐`,
      tags: seasonalTags,
    },
  });
});

router.get('/popular', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { limit = '10' } = req.query;
  
  const rows = db.prepare(`
    SELECT * FROM recipes
    ORDER BY view_count DESC, rating DESC
    LIMIT ?
  `).all(Number(limit)) as any[];
  
  const recipes = rows.map(row => buildRecipeFromRow(row, currentUserId));
  
  res.json({
    success: true,
    data: recipes,
  });
});

export default router;
