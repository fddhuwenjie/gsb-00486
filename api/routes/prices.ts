import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUserIdFromHeader } from '../utils.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT p1.*
    FROM ingredient_prices p1
    INNER JOIN (
      SELECT ingredient_name, MAX(recorded_at) as max_date
      FROM ingredient_prices
      GROUP BY ingredient_name
    ) p2 ON p1.ingredient_name = p2.ingredient_name AND p1.recorded_at = p2.max_date
    ORDER BY p1.ingredient_name
  `).all() as any[];

  const prices = rows.map(row => ({
    id: row.id,
    ingredientName: row.ingredient_name,
    price: row.price,
    unit: row.unit,
    marketName: row.market_name,
    recordedAt: row.recorded_at,
  }));

  res.json({
    success: true,
    data: prices,
  });
});

router.get('/history/:ingredientName', (req: Request, res: Response) => {
  const { ingredientName } = req.params;
  const days = 30;

  const rows = db.prepare(`
    SELECT id, ingredient_name, price, unit, market_name, recorded_at
    FROM ingredient_prices
    WHERE ingredient_name = ? AND recorded_at >= datetime('now', ?)
    ORDER BY recorded_at ASC
  `).all(ingredientName, `-${days} days`) as any[];

  const history = rows.map(row => ({
    id: row.id,
    ingredientName: row.ingredient_name,
    price: row.price,
    unit: row.unit,
    marketName: row.market_name,
    recordedAt: row.recorded_at,
  }));

  res.json({
    success: true,
    data: history,
  });
});

router.post('/', (req: Request, res: Response) => {
  const { ingredientName, price, unit, marketName } = req.body;

  if (!ingredientName || price === undefined) {
    res.status(400).json({ success: false, error: '请提供食材名称和价格' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO ingredient_prices (ingredient_name, price, unit, market_name)
    VALUES (?, ?, ?, ?)
  `).run(
    ingredientName,
    price,
    unit || '100g',
    marketName || ''
  );

  const newPrice = {
    id: Number(result.lastInsertRowid),
    ingredientName,
    price,
    unit: unit || '100g',
    marketName: marketName || '',
    recordedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: newPrice,
  });
});

router.get('/budget', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const budgetRow = db.prepare(
    'SELECT weekly_budget FROM user_budgets WHERE user_id = ?'
  ).get(currentUserId) as any;

  const weeklyBudget = budgetRow?.weekly_budget || 200;

  res.json({
    success: true,
    data: {
      weeklyBudget,
    },
  });
});

router.put('/budget', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const { weeklyBudget } = req.body;
  if (!weeklyBudget || weeklyBudget <= 0) {
    res.status(400).json({ success: false, error: '请提供有效的预算金额' });
    return;
  }

  const existing = db.prepare('SELECT id FROM user_budgets WHERE user_id = ?').get(currentUserId);

  if (existing) {
    db.prepare(`
      UPDATE user_budgets SET weekly_budget = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(weeklyBudget, currentUserId);
  } else {
    db.prepare(`
      INSERT INTO user_budgets (user_id, weekly_budget)
      VALUES (?, ?)
    `).run(currentUserId, weeklyBudget);
  }

  res.json({
    success: true,
    data: { weeklyBudget },
    message: '预算设置成功',
  });
});

router.get('/meal-plan-cost/:planId', (req: Request, res: Response) => {
  const { planId } = req.params;
  const currentUserId = getUserIdFromHeader(req);

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(planId) as any;
  if (!plan || plan.user_id !== currentUserId) {
    res.status(403).json({ success: false, error: '无权限访问' });
    return;
  }

  const items = db.prepare(`
    SELECT mpi.*, r.id as recipe_id, r.title
    FROM meal_plan_items mpi
    LEFT JOIN recipes r ON mpi.recipe_id = r.id
    WHERE mpi.meal_plan_id = ?
  `).all(planId) as any[];

  let totalCost = 0;
  const breakdown: any[] = [];

  const latestPrices = db.prepare(`
    SELECT p1.*
    FROM ingredient_prices p1
    INNER JOIN (
      SELECT ingredient_name, MAX(recorded_at) as max_date
      FROM ingredient_prices
      GROUP BY ingredient_name
    ) p2 ON p1.ingredient_name = p2.ingredient_name AND p1.recorded_at = p2.max_date
  `).all() as any[];

  const priceMap: Record<string, number> = {};
  latestPrices.forEach((p: any) => {
    priceMap[p.ingredient_name] = p.price;
  });

  for (const item of items) {
    if (item.recipe_id) {
      const ingredients = db.prepare(
        'SELECT name, amount, unit FROM recipe_ingredients WHERE recipe_id = ?'
      ).all(item.recipe_id) as any[];

      let recipeCost = 0;
      for (const ing of ingredients) {
        const pricePer100g = priceMap[ing.name] || 0;
        const cost = (ing.amount / 100) * pricePer100g;
        recipeCost += cost;
      }

      totalCost += recipeCost;
      breakdown.push({
        itemId: item.id,
        recipeTitle: item.title,
        mealType: item.meal_type,
        day: item.day,
        cost: Math.round(recipeCost * 100) / 100,
      });
    }
  }

  res.json({
    success: true,
    data: {
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown,
    },
  });
});

export default router;
