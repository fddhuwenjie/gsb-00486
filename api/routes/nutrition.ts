import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

router.get('/ingredients', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM ingredient_nutrition ORDER BY category, name').all() as any[];
  
  const data = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    pricePer100g: row.price_per_100g,
  }));
  
  res.json({
    success: true,
    data,
  });
});

router.get('/ingredients/search', (req: Request, res: Response) => {
  const { q } = req.query;
  
  if (!q) {
    res.json({ success: true, data: [] });
    return;
  }
  
  const rows = db.prepare(`
    SELECT * FROM ingredient_nutrition 
    WHERE name LIKE ?
    ORDER BY name
    LIMIT 20
  `).all(`%${q}%`) as any[];
  
  const data = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    pricePer100g: row.price_per_100g,
  }));
  
  res.json({
    success: true,
    data,
  });
});

router.post('/calculate-recipe', (req: Request, res: Response) => {
  const { ingredients, servings = 1 } = req.body;
  
  if (!ingredients || !Array.isArray(ingredients)) {
    res.status(400).json({ success: false, error: '请提供食材列表' });
    return;
  }
  
  const nutritionMap = {};
  const nutriRows = db.prepare('SELECT * FROM ingredient_nutrition').all() as any[];
  for (const row of nutriRows) {
    (nutritionMap as any)[row.name] = row;
  }
  
  let total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const unmatched: string[] = [];
  
  for (const ing of ingredients) {
    const nutri = (nutritionMap as any)[ing.name];
    if (nutri) {
      const factor = ing.amount / 100;
      total.calories += nutri.calories * factor;
      total.protein += nutri.protein * factor;
      total.carbs += nutri.carbs * factor;
      total.fat += nutri.fat * factor;
    } else {
      unmatched.push(ing.name);
    }
  }
  
  const perServing = {
    calories: Math.round(total.calories / servings),
    protein: Math.round((total.protein / servings) * 10) / 10,
    carbs: Math.round((total.carbs / servings) * 10) / 10,
    fat: Math.round((total.fat / servings) * 10) / 10,
  };
  
  const totalRounded = {
    calories: Math.round(total.calories),
    protein: Math.round(total.protein * 10) / 10,
    carbs: Math.round(total.carbs * 10) / 10,
    fat: Math.round(total.fat * 10) / 10,
  };
  
  res.json({
    success: true,
    data: {
      total: totalRounded,
      perServing,
      servings,
      unmatchedIngredients: unmatched,
    },
  });
});

export default router;
