import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUserIdFromHeader, buildRecipeFromRow, getSupermarketCategory, getNutritionMap, RECOMMENDED_NUTRITION } from '../utils.js';
import type { MealPlan, ShoppingItem, Ingredient, WeeklyNutrition, Nutrition } from '../../shared/types.js';

const router = Router();

function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function buildMealPlanResponse(planId: number, currentUserId: number | null): MealPlan {
  const items = db.prepare(`
    SELECT * FROM meal_plan_items WHERE meal_plan_id = ?
  `).all(planId) as any[];
  
  const plan: any = {};
  
  for (let day = 1; day <= 7; day++) {
    plan[day] = {};
  }
  
  for (const item of items) {
    const day = item.day;
    const mealType = item.meal_type as 'breakfast' | 'lunch' | 'dinner';
    
    let recipeData = undefined;
    if (item.recipe_id) {
      const recipeRow = db.prepare('SELECT * FROM recipes WHERE id = ?').get(item.recipe_id);
      if (recipeRow) {
        recipeData = buildRecipeFromRow(recipeRow, currentUserId);
      }
    }
    
    plan[day][mealType] = {
      id: item.id,
      recipeId: item.recipe_id || undefined,
      recipe: recipeData,
      customTitle: item.custom_title || undefined,
      customIngredients: item.custom_ingredients ? JSON.parse(item.custom_ingredients) : undefined,
    };
  }
  
  return plan as MealPlan;
}

router.post('/apply-template', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const { planId, templateId } = req.body;

  if (!planId || !templateId) {
    res.status(400).json({ success: false, error: '参数不完整' });
    return;
  }

  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, currentUserId);
  if (!plan) {
    res.status(404).json({ success: false, error: '膳食计划不存在' });
    return;
  }

  const template = db.prepare('SELECT * FROM meal_plan_templates WHERE id = ? AND user_id = ?').get(templateId, currentUserId) as any;
  if (!template) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }

  const templatePlan = JSON.parse(template.plan_data);

  db.prepare('DELETE FROM meal_plan_items WHERE meal_plan_id = ?').run(planId);

  const insertItem = db.prepare(`
    INSERT INTO meal_plan_items (meal_plan_id, day, meal_type, recipe_id, custom_title, custom_ingredients)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let day = 1; day <= 7; day++) {
    const dayPlan = templatePlan[day];
    if (!dayPlan) continue;

    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const item = dayPlan[mealType];
      if (!item) continue;

      insertItem.run(
        planId,
        day,
        mealType,
        item.recipeId || item.recipe_id || null,
        item.customTitle || item.custom_title || null,
        item.customIngredients || item.custom_ingredients
          ? JSON.stringify(item.customIngredients || item.custom_ingredients)
          : null
      );
    }
  }

  const mealPlan = buildMealPlanResponse(planId, currentUserId);

  res.json({
    success: true,
    data: mealPlan,
  });
});

router.get('/current', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const weekStart = getWeekStartDate();
  
  let plan = db.prepare(`
    SELECT * FROM meal_plans 
    WHERE user_id = ? AND week_start_date = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(currentUserId, weekStart) as any;
  
  let planId: number;
  
  if (!plan) {
    const result = db.prepare(`
      INSERT INTO meal_plans (user_id, name, week_start_date)
      VALUES (?, ?, ?)
    `).run(currentUserId, '本周膳食计划', weekStart);
    planId = Number(result.lastInsertRowid);
    
    const sampleRecipes = db.prepare('SELECT id FROM recipes ORDER BY RANDOM() LIMIT 6').all() as any[];
    const insertItem = db.prepare(`
      INSERT INTO meal_plan_items (meal_plan_id, day, meal_type, recipe_id)
      VALUES (?, ?, ?, ?)
    `);
    
    if (sampleRecipes.length >= 6) {
      insertItem.run(planId, 1, 'breakfast', sampleRecipes[0].id);
      insertItem.run(planId, 1, 'lunch', sampleRecipes[1].id);
      insertItem.run(planId, 1, 'dinner', sampleRecipes[2].id);
      insertItem.run(planId, 2, 'breakfast', sampleRecipes[3].id);
      insertItem.run(planId, 2, 'lunch', sampleRecipes[4].id);
      insertItem.run(planId, 2, 'dinner', sampleRecipes[5].id);
    }
  } else {
    planId = plan.id;
  }
  
  const mealPlan = buildMealPlanResponse(planId, currentUserId);
  
  res.json({
    success: true,
    data: {
      id: planId,
      weekStartDate: weekStart,
      plan: mealPlan,
    },
  });
});

router.put('/item', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const { planId, day, mealType, recipeId, customTitle, customIngredients } = req.body;
  
  if (!planId || !day || !mealType) {
    res.status(400).json({ success: false, error: '参数不完整' });
    return;
  }
  
  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, currentUserId);
  if (!plan) {
    res.status(404).json({ success: false, error: '膳食计划不存在' });
    return;
  }
  
  const existing = db.prepare(`
    SELECT id FROM meal_plan_items 
    WHERE meal_plan_id = ? AND day = ? AND meal_type = ?
  `).get(planId, day, mealType) as any;
  
  if (existing) {
    if (recipeId !== undefined || customTitle !== undefined) {
      db.prepare(`
        UPDATE meal_plan_items 
        SET recipe_id = ?, custom_title = ?, custom_ingredients = ?
        WHERE id = ?
      `).run(
        recipeId || null,
        customTitle || null,
        customIngredients ? JSON.stringify(customIngredients) : null,
        existing.id
      );
    } else {
      db.prepare('DELETE FROM meal_plan_items WHERE id = ?').run(existing.id);
    }
  } else if (recipeId || customTitle) {
    db.prepare(`
      INSERT INTO meal_plan_items (meal_plan_id, day, meal_type, recipe_id, custom_title, custom_ingredients)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      planId,
      day,
      mealType,
      recipeId || null,
      customTitle || null,
      customIngredients ? JSON.stringify(customIngredients) : null
    );
  }
  
  const mealPlan = buildMealPlanResponse(planId, currentUserId);
  
  res.json({
    success: true,
    data: mealPlan,
  });
});

router.get('/shopping-list/:planId', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { planId } = req.params;
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, currentUserId);
  if (!plan) {
    res.status(404).json({ success: false, error: '膳食计划不存在' });
    return;
  }
  
  const items = db.prepare(`
    SELECT * FROM meal_plan_items WHERE meal_plan_id = ?
  `).all(planId) as any[];
  
  const ingredientMap: Record<string, { amount: number; unit: string; category: string; price: number }> = {};
  const nutritionMap = getNutritionMap();
  
  for (const item of items) {
    let ingredients: Ingredient[] = [];
    
    if (item.recipe_id) {
      const recipeIngredients = db.prepare(`
        SELECT name, amount, unit FROM recipe_ingredients WHERE recipe_id = ?
      `).all(item.recipe_id) as any[];
      ingredients = recipeIngredients;
    } else if (item.custom_ingredients) {
      ingredients = JSON.parse(item.custom_ingredients);
    }
    
    for (const ing of ingredients) {
      const key = `${ing.name}_${ing.unit}`;
      if (!ingredientMap[key]) {
        const nutriInfo = nutritionMap[ing.name];
        ingredientMap[key] = {
          amount: 0,
          unit: ing.unit,
          category: nutriInfo?.category || getSupermarketCategory(ing.name),
          price: nutriInfo?.price_per_100g || 0,
        };
      }
      ingredientMap[key].amount += ing.amount;
    }
  }
  
  const shoppingList: ShoppingItem[] = Object.entries(ingredientMap).map(([key, value]) => {
    const [name] = key.split('_');
    const estimatedPrice = Math.round((value.amount / 100) * value.price * 100) / 100;
    
    return {
      name,
      totalAmount: Math.round(value.amount * 10) / 10,
      unit: value.unit,
      category: value.category,
      estimatedPrice,
      purchased: false,
    };
  });
  
  shoppingList.sort((a, b) => a.category.localeCompare(b.category));
  
  const totalPrice = shoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);
  
  res.json({
    success: true,
    data: {
      items: shoppingList,
      totalPrice: Math.round(totalPrice * 100) / 100,
    },
  });
});

router.get('/nutrition/:planId', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { planId } = req.params;
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, currentUserId);
  if (!plan) {
    res.status(404).json({ success: false, error: '膳食计划不存在' });
    return;
  }
  
  const items = db.prepare(`
    SELECT * FROM meal_plan_items WHERE meal_plan_id = ?
  `).all(planId) as any[];
  
  const nutritionMap = getNutritionMap();
  let totalNutrition: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let mealCount = 0;
  
  for (const item of items) {
    let ingredients: Ingredient[] = [];
    
    if (item.recipe_id) {
      const recipe = db.prepare('SELECT servings FROM recipes WHERE id = ?').get(item.recipe_id) as any;
      const recipeIngredients = db.prepare(`
        SELECT name, amount, unit FROM recipe_ingredients WHERE recipe_id = ?
      `).all(item.recipe_id) as any[];
      
      const servings = recipe?.servings || 1;
      ingredients = recipeIngredients.map((i: any) => ({
        ...i,
        amount: i.amount / servings,
      }));
      mealCount++;
    } else if (item.custom_ingredients) {
      ingredients = JSON.parse(item.custom_ingredients);
      mealCount++;
    }
    
    for (const ing of ingredients) {
      const nutri = nutritionMap[ing.name];
      if (nutri) {
        const factor = ing.amount / 100;
        totalNutrition.calories += nutri.calories * factor;
        totalNutrition.protein += nutri.protein * factor;
        totalNutrition.carbs += nutri.carbs * factor;
        totalNutrition.fat += nutri.fat * factor;
      }
    }
  }
  
  const daysWithMeals = new Set(items.map(i => i.day)).size || 1;
  
  const weeklyTotal: Nutrition = {
    calories: Math.round(totalNutrition.calories),
    protein: Math.round(totalNutrition.protein * 10) / 10,
    carbs: Math.round(totalNutrition.carbs * 10) / 10,
    fat: Math.round(totalNutrition.fat * 10) / 10,
  };
  
  const dailyAverage: Nutrition = {
    calories: Math.round(totalNutrition.calories / daysWithMeals),
    protein: Math.round((totalNutrition.protein / daysWithMeals) * 10) / 10,
    carbs: Math.round((totalNutrition.carbs / daysWithMeals) * 10) / 10,
    fat: Math.round((totalNutrition.fat / daysWithMeals) * 10) / 10,
  };
  
  const warnings: string[] = [];
  const recommended = RECOMMENDED_NUTRITION;
  
  if (dailyAverage.calories < recommended.calories * 0.7) {
    warnings.push('每日热量摄入偏低，建议增加食物摄入量');
  } else if (dailyAverage.calories > recommended.calories * 1.3) {
    warnings.push('每日热量摄入偏高，注意控制饮食');
  }
  
  if (dailyAverage.protein < recommended.protein * 0.7) {
    warnings.push('蛋白质摄入不足，建议增加蛋奶、肉类');
  }
  
  if (dailyAverage.fat > recommended.fat * 1.3) {
    warnings.push('脂肪摄入偏高，建议减少油腻食物');
  }
  
  const weeklyNutrition: WeeklyNutrition = {
    dailyAverage,
    weeklyTotal,
    recommended,
  };
  
  res.json({
    success: true,
    data: {
      ...weeklyNutrition,
      warnings,
    },
  });
});

router.get('/templates', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const rows = db.prepare(`
    SELECT * FROM meal_plan_templates 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(currentUserId) as any[];
  
  const templates = rows.map(row => ({
    id: row.id,
    name: row.name,
    plan: JSON.parse(row.plan_data),
    createdAt: row.created_at,
  }));
  
  res.json({
    success: true,
    data: templates,
  });
});

router.post('/templates', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const { name, plan } = req.body;
  
  if (!name || !plan) {
    res.status(400).json({ success: false, error: '请填写模板名称和计划内容' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO meal_plan_templates (user_id, name, plan_data)
    VALUES (?, ?, ?)
  `).run(currentUserId, name, JSON.stringify(plan));
  
  res.json({
    success: true,
    data: { id: Number(result.lastInsertRowid), name, plan },
  });
});

router.delete('/templates/:id', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { id } = req.params;
  
  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  
  const template = db.prepare('SELECT * FROM meal_plan_templates WHERE id = ? AND user_id = ?').get(id, currentUserId);
  if (!template) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }
  
  db.prepare('DELETE FROM meal_plan_templates WHERE id = ?').run(id);
  
  res.json({
    success: true,
    message: '删除成功',
  });
});

router.post('/shopping-list/:planId/save', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { planId } = req.params;

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, currentUserId);
  if (!plan) {
    res.status(404).json({ success: false, error: '膳食计划不存在' });
    return;
  }

  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    res.status(400).json({ success: false, error: '无效的购物清单数据' });
    return;
  }

  const existing = db.prepare('SELECT id FROM shopping_lists WHERE meal_plan_id = ?').get(planId) as any;

  if (existing) {
    db.prepare('UPDATE shopping_lists SET items = ? WHERE id = ?').run(JSON.stringify(items), existing.id);
  } else {
    db.prepare('INSERT INTO shopping_lists (user_id, meal_plan_id, items) VALUES (?, ?, ?)').run(currentUserId, planId, JSON.stringify(items));
  }

  res.json({ success: true, data: { saved: true } });
});

router.get('/shopping-list/:planId/saved', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { planId } = req.params;

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const row = db.prepare('SELECT * FROM shopping_lists WHERE meal_plan_id = ?').get(planId) as any;

  if (!row) {
    res.json({ success: true, data: null });
    return;
  }

  res.json({
    success: true,
    data: {
      id: row.id,
      items: JSON.parse(row.items),
      createdAt: row.created_at,
    },
  });
});

router.get('/shopping-list/:planId/export', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const { planId } = req.params;

  if (!currentUserId) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }

  const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, currentUserId);
  if (!plan) {
    res.status(404).json({ success: false, error: '膳食计划不存在' });
    return;
  }

  const { items: shoppingItems, totalPrice } = generateShoppingList(Number(planId));

  const categoryOrder = ['蔬菜', '肉类', '蛋奶', '主食', '调料', '其他'];
  const grouped: Record<string, ShoppingItem[]> = {};
  for (const item of shoppingItems) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  let text = `🛒 采购清单\n${'='.repeat(30)}\n\n`;

  for (const cat of categoryOrder) {
    if (!grouped[cat]) continue;
    text += `【${cat}】\n`;
    for (const item of grouped[cat]) {
      const check = item.purchased ? '✅' : '⬜';
      text += `  ${check} ${item.name}  ${item.totalAmount}${item.unit}  ¥${item.estimatedPrice}\n`;
    }
    text += '\n';
  }

  text += `${'='.repeat(30)}\n预估总价: ¥${totalPrice.toFixed(2)}\n`;

  res.json({
    success: true,
    data: { text },
  });
});

function generateShoppingList(planId: number): { items: ShoppingItem[]; totalPrice: number } {
  const items = db.prepare(`
    SELECT * FROM meal_plan_items WHERE meal_plan_id = ?
  `).all(planId) as any[];

  const ingredientMap: Record<string, { amount: number; unit: string; category: string; price: number }> = {};
  const nutritionMap = getNutritionMap();

  for (const item of items) {
    let ingredients: Ingredient[] = [];

    if (item.recipe_id) {
      const recipeIngredients = db.prepare(`
        SELECT name, amount, unit FROM recipe_ingredients WHERE recipe_id = ?
      `).all(item.recipe_id) as any[];
      ingredients = recipeIngredients;
    } else if (item.custom_ingredients) {
      ingredients = JSON.parse(item.custom_ingredients);
    }

    for (const ing of ingredients) {
      const key = `${ing.name}_${ing.unit}`;
      if (!ingredientMap[key]) {
        const nutriInfo = nutritionMap[ing.name];
        ingredientMap[key] = {
          amount: 0,
          unit: ing.unit,
          category: nutriInfo?.category || getSupermarketCategory(ing.name),
          price: nutriInfo?.price_per_100g || 0,
        };
      }
      ingredientMap[key].amount += ing.amount;
    }
  }

  const shoppingList: ShoppingItem[] = Object.entries(ingredientMap).map(([key, value]) => {
    const [name] = key.split('_');
    const estimatedPrice = Math.round((value.amount / 100) * value.price * 100) / 100;

    return {
      name,
      totalAmount: Math.round(value.amount * 10) / 10,
      unit: value.unit,
      category: value.category,
      estimatedPrice,
      purchased: false,
    };
  });

  shoppingList.sort((a, b) => a.category.localeCompare(b.category));

  const totalPrice = shoppingList.reduce((sum, item) => sum + item.estimatedPrice, 0);

  return { items: shoppingList, totalPrice: Math.round(totalPrice * 100) / 100 };
}

export default router;
