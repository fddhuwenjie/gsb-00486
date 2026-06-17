import db from './db.js';
import type { Recipe, Ingredient, Nutrition, UserProfile } from '../shared/types.js';

export function getUserIdFromHeader(req: any): number | null {
  const userId = req.headers['x-user-id'];
  return userId ? parseInt(userId as string, 10) : null;
}

export function calculateRecipeNutrition(ingredients: Ingredient[]): { total: Nutrition; perServing: Nutrition; servings: number } {
  const nutritionMap = getNutritionMap();
  
  let total: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (const ing of ingredients) {
    const nutri = nutritionMap[ing.name];
    if (nutri) {
      const factor = ing.amount / 100;
      total.calories += nutri.calories * factor;
      total.protein += nutri.protein * factor;
      total.carbs += nutri.carbs * factor;
      total.fat += nutri.fat * factor;
    }
  }
  
  return {
    total: {
      calories: Math.round(total.calories),
      protein: Math.round(total.protein * 10) / 10,
      carbs: Math.round(total.carbs * 10) / 10,
      fat: Math.round(total.fat * 10) / 10,
    },
    perServing: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
    servings: 1,
  };
}

let _nutritionMap: Record<string, any> | null = null;
export function getNutritionMap(): Record<string, any> {
  if (!_nutritionMap) {
    const rows = db.prepare('SELECT * FROM ingredient_nutrition').all();
    _nutritionMap = {};
    for (const row of rows as any[]) {
      _nutritionMap[row.name] = row;
    }
  }
  return _nutritionMap;
}

export function refreshNutritionMap() {
  _nutritionMap = null;
}

export function buildRecipeFromRow(row: any, currentUserId: number | null = null): Recipe {
  const ingredients = db.prepare('SELECT name, amount, unit, sort_order FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order').all(row.id) as any[];
  const steps = db.prepare('SELECT step_order as "order", description, image_url as imageUrl FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order').all(row.id) as any[];
  const tags = db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ?').all(row.id).map((t: any) => t.tag) as string[];
  
  const author = db.prepare('SELECT id, username, avatar, bio FROM users WHERE id = ?').get(row.author_id) as any;
  
  const authorProfile: UserProfile = {
    id: author.id,
    username: author.username,
    avatar: author.avatar,
    bio: author.bio,
    recipeCount: 0,
    followerCount: 0,
    followingCount: 0,
    isFollowing: false,
  };
  
  const nutritionData = calculateRecipeNutrition(ingredients);
  const servings = row.servings || 1;
  
  let isFavorite = false;
  if (currentUserId) {
    const fav = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?').get(currentUserId, row.id);
    isFavorite = !!fav;
  }
  
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    difficulty: row.difficulty,
    cookTime: row.cook_time,
    servings: servings,
    tags: tags,
    coverImage: row.cover_image,
    ingredients: ingredients.map((i: any) => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
    })),
    steps: steps.map((s: any) => ({
      order: s.order,
      description: s.description,
      imageUrl: s.imageUrl,
    })),
    author: authorProfile,
    nutritionTotal: nutritionData.total,
    nutritionPerServing: {
      calories: Math.round(nutritionData.total.calories / servings),
      protein: Math.round(nutritionData.total.protein / servings * 10) / 10,
      carbs: Math.round(nutritionData.total.carbs / servings * 10) / 10,
      fat: Math.round(nutritionData.total.fat / servings * 10) / 10,
    },
    rating: row.rating || 0,
    ratingCount: row.rating_count || 0,
    viewCount: row.view_count || 0,
    isFavorite: isFavorite,
    createdAt: row.created_at,
  };
}

export function getSupermarketCategory(ingredientName: string): string {
  const veggieList = ['西红柿', '西兰花', '青菜', '土豆', '洋葱', '胡萝卜', '黄瓜', '生菜', '山药', '蘑菇'];
  const meatList = ['鸡胸肉', '牛肉', '猪肉', '三文鱼', '虾', '排骨', '鸡腿', '培根', '香肠', '鸭肉', '羊肉'];
  const stapleList = ['大米', '面粉', '面条', '面包', '馒头', '糙米', '燕麦', '红薯', '玉米', '手指饼干', '木薯粉'];
  const dairyList = ['牛奶', '鸡蛋', '黄油', '奶酪', '酸奶', '马斯卡彭奶酪'];
  const seasoningList = ['食用油', '酱油', '盐', '糖', '醋', '料酒', '味精', '鸡精', '蚝油', '生抽', '老抽', '蜂蜜', '咖啡', '红茶', '味噌'];
  
  if (veggieList.some(v => ingredientName.includes(v))) return '蔬菜';
  if (meatList.some(m => ingredientName.includes(m))) return '肉类';
  if (stapleList.some(s => ingredientName.includes(s))) return '主食';
  if (dairyList.some(d => ingredientName.includes(d))) return '蛋奶';
  if (seasoningList.some(s => ingredientName.includes(s))) return '调料';
  
  return '其他';
}

export const RECOMMENDED_NUTRITION = {
  calories: 2000,
  protein: 60,
  carbs: 300,
  fat: 65,
};
