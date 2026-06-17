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

interface ScoredRecipe {
  id: number;
  row: any;
  tags: string[];
  category: string;
  score: number;
  tagMatchScore: number;
  seasonalScore: number;
  ratingScore: number;
  popularityScore: number;
  source: string[];
  viewed: boolean;
}

const RECALL_LIMITS = {
  favorite: 20,
  viewHistory: 20,
  seasonal: 15,
  popular: 15,
};

const FINAL_COUNT = 12;
const MAX_PER_CATEGORY = 3;
const MIN_CATEGORY_COUNT = 3;

const WEIGHTS = {
  tagMatch: 0.40,
  seasonal: 0.20,
  rating: 0.15,
  popularity: 0.15,
  novelty: 0.10,
};

const COLD_START_WEIGHTS = {
  tagMatch: 0.20,
  seasonal: 0.30,
  rating: 0.25,
  popularity: 0.25,
  novelty: 0.0,
};

function getMaxViewCount(): number {
  const row = db.prepare('SELECT MAX(view_count) as max_vc FROM recipes').get() as any;
  return row?.max_vc || 1000;
}

function getRecipeTags(recipeId: number): string[] {
  return (db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ?').all(recipeId) as any[])
    .map((r: any) => r.tag);
}

function calcTagMatchScore(
  recipeTags: string[],
  favoriteTagSet: Set<string>,
  viewTagSet: Set<string>,
  maxPossibleWeight: number
): number {
  if (maxPossibleWeight === 0) return 0;
  let totalWeight = 0;
  for (const tag of recipeTags) {
    if (favoriteTagSet.has(tag)) totalWeight += 1.5;
    else if (viewTagSet.has(tag)) totalWeight += 1.0;
  }
  return Math.min(totalWeight / maxPossibleWeight, 1.0);
}

function calcSeasonalScore(
  category: string,
  recipeTags: string[],
  seasonalCategories: string[],
  seasonalTags: string[]
): number {
  let score = 0;
  if (seasonalCategories.includes(category)) score += 0.6;
  const hasSeasonalTag = recipeTags.some(t => seasonalTags.includes(t));
  if (hasSeasonalTag) score += 0.4;
  return score;
}

function calcRatingScore(rating: number): number {
  return Math.min(rating / 5.0, 1.0);
}

function calcPopularityScore(viewCount: number, maxViewCount: number): number {
  if (maxViewCount <= 1) return 0;
  return Math.log(viewCount + 1) / Math.log(maxViewCount + 1);
}

function buildScoredRecipe(
  row: any,
  favoriteTagSet: Set<string>,
  viewTagSet: Set<string>,
  maxTagWeight: number,
  seasonalCategories: string[],
  seasonalTags: string[],
  maxViewCount: number,
  isViewed: boolean,
  source: string,
  weights: typeof WEIGHTS
): ScoredRecipe {
  const tags = getRecipeTags(row.id);
  const category = row.category;

  const tagMatchScore = calcTagMatchScore(tags, favoriteTagSet, viewTagSet, maxTagWeight);
  const seasonalScore = calcSeasonalScore(category, tags, seasonalCategories, seasonalTags);
  const ratingScore = calcRatingScore(row.rating || 0);
  const popularityScore = calcPopularityScore(row.view_count || 0, maxViewCount);
  const noveltyScore = isViewed ? 0.0 : 1.0;

  const score =
    weights.tagMatch * tagMatchScore +
    weights.seasonal * seasonalScore +
    weights.rating * ratingScore +
    weights.popularity * popularityScore +
    weights.novelty * noveltyScore;

  return {
    id: row.id,
    row,
    tags,
    category,
    score,
    tagMatchScore,
    seasonalScore,
    ratingScore,
    popularityScore,
    source: [source],
    viewed: isViewed,
  };
}

function mergeCandidates(existing: Map<number, ScoredRecipe>, newItems: ScoredRecipe[]): void {
  for (const item of newItems) {
    const existingItem = existing.get(item.id);
    if (existingItem) {
      existingItem.score = Math.max(existingItem.score, item.score);
      for (const s of item.source) {
        if (!existingItem.source.includes(s)) existingItem.source.push(s);
      }
    } else {
      existing.set(item.id, item);
    }
  }
}

function diversitySelect(candidates: ScoredRecipe[], count: number, maxPerCategory: number): ScoredRecipe[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: ScoredRecipe[] = [];
  const categoryCount: Record<string, number> = {};

  for (const candidate of sorted) {
    if (selected.length >= count) break;
    const catCount = categoryCount[candidate.category] || 0;
    if (catCount >= maxPerCategory) continue;
    selected.push(candidate);
    categoryCount[candidate.category] = catCount + 1;
  }

  if (selected.length < count) {
    const selectedIds = new Set(selected.map(s => s.id));
    for (const candidate of sorted) {
      if (selected.length >= count) break;
      if (selectedIds.has(candidate.id)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.id);
    }
  }

  return selected.slice(0, count);
}

router.get('/personalized', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const currentMonth = new Date().getMonth() + 1;
  const seasonalCategories = SEASONAL_CATEGORIES[currentMonth] || [];
  const seasonalTags = SEASONAL_TAGS[currentMonth] || [];
  const maxViewCount = getMaxViewCount();

  let favoriteTags: string[] = [];
  let viewHistoryTags: string[] = [];
  let viewedRecipeIds: Set<number> = new Set();
  let isColdStart = false;

  if (currentUserId) {
    favoriteTags = (db.prepare(`
      SELECT DISTINCT rt.tag FROM recipe_tags rt
      INNER JOIN favorites f ON rt.recipe_id = f.recipe_id
      WHERE f.user_id = ?
    `).all(currentUserId) as any[]).map((r: any) => r.tag);

    viewHistoryTags = (db.prepare(`
      SELECT DISTINCT rt.tag FROM recipe_tags rt
      INNER JOIN view_history vh ON rt.recipe_id = vh.recipe_id
      WHERE vh.user_id = ?
    `).all(currentUserId) as any[]).map((r: any) => r.tag);

    const viewedRows = db.prepare(`
      SELECT recipe_id FROM view_history WHERE user_id = ?
    `).all(currentUserId) as any[];
    viewedRecipeIds = new Set(viewedRows.map((r: any) => r.recipe_id));

    const totalUniqueTags = new Set([...favoriteTags, ...viewHistoryTags]).size;
    isColdStart = totalUniqueTags < 3;
  } else {
    isColdStart = true;
  }

  const weights = isColdStart ? COLD_START_WEIGHTS : WEIGHTS;
  const favoriteTagSet = new Set(favoriteTags);
  const viewTagSet = new Set(viewHistoryTags);

  const maxTagWeight = favoriteTagSet.size * 1.5 + viewTagSet.size * 1.0;

  const candidates = new Map<number, ScoredRecipe>();

  if (!isColdStart && favoriteTagSet.size > 0) {
    const favPlaceholders = Array.from(favoriteTagSet).map(() => '?').join(',');
    const favRows = db.prepare(`
      SELECT r.*, COUNT(rt.tag) as tag_match_count
      FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${favPlaceholders})
      GROUP BY r.id
      ORDER BY tag_match_count DESC, r.rating DESC, r.view_count DESC
      LIMIT ?
    `).all(...Array.from(favoriteTagSet), RECALL_LIMITS.favorite) as any[];

    const favScored = favRows.map(row =>
      buildScoredRecipe(
        row,
        favoriteTagSet,
        viewTagSet,
        maxTagWeight,
        seasonalCategories,
        seasonalTags,
        maxViewCount,
        viewedRecipeIds.has(row.id),
        '收藏标签',
        weights
      )
    );
    mergeCandidates(candidates, favScored);
  }

  if (!isColdStart && viewTagSet.size > 0) {
    const viewPlaceholders = Array.from(viewTagSet).map(() => '?').join(',');
    const viewRows = db.prepare(`
      SELECT r.*, COUNT(rt.tag) as tag_match_count
      FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${viewPlaceholders})
      GROUP BY r.id
      ORDER BY tag_match_count DESC, r.rating DESC, r.view_count DESC
      LIMIT ?
    `).all(...Array.from(viewTagSet), RECALL_LIMITS.viewHistory) as any[];

    const viewScored = viewRows.map(row =>
      buildScoredRecipe(
        row,
        favoriteTagSet,
        viewTagSet,
        maxTagWeight,
        seasonalCategories,
        seasonalTags,
        maxViewCount,
        viewedRecipeIds.has(row.id),
        '浏览标签',
        weights
      )
    );
    mergeCandidates(candidates, viewScored);
  }

  if (seasonalCategories.length > 0) {
    const seasonPlaceholders = seasonalCategories.map(() => '?').join(',');
    const seasonRows = db.prepare(`
      SELECT r.* FROM recipes r
      WHERE r.category IN (${seasonPlaceholders})
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT ?
    `).all(...seasonalCategories, RECALL_LIMITS.seasonal) as any[];

    const seasonScored = seasonRows.map(row =>
      buildScoredRecipe(
        row,
        favoriteTagSet,
        viewTagSet,
        maxTagWeight,
        seasonalCategories,
        seasonalTags,
        maxViewCount,
        viewedRecipeIds.has(row.id),
        '时令推荐',
        weights
      )
    );
    mergeCandidates(candidates, seasonScored);
  }

  const popularRows = db.prepare(`
    SELECT * FROM recipes
    ORDER BY rating DESC, view_count DESC
    LIMIT ?
  `).all(RECALL_LIMITS.popular) as any[];

  const popularScored = popularRows.map(row =>
    buildScoredRecipe(
      row,
      favoriteTagSet,
      viewTagSet,
      maxTagWeight,
      seasonalCategories,
      seasonalTags,
      maxViewCount,
      viewedRecipeIds.has(row.id),
      '热门推荐',
      weights
    )
  );
  mergeCandidates(candidates, popularScored);

  const allCandidates = Array.from(candidates.values());
  const finalRecipes = diversitySelect(allCandidates, FINAL_COUNT, MAX_PER_CATEGORY);

  const uniqueCategories = new Set(finalRecipes.map(r => r.category));
  if (uniqueCategories.size < MIN_CATEGORY_COUNT && allCandidates.length > finalRecipes.length) {
    const selectedIds = new Set(finalRecipes.map(r => r.id));
    const remaining = allCandidates
      .filter(c => !selectedIds.has(c.id))
      .sort((a, b) => b.score - a.score);

    for (let i = finalRecipes.length - 1; i >= 0 && uniqueCategories.size < MIN_CATEGORY_COUNT; i--) {
      for (const candidate of remaining) {
        if (!uniqueCategories.has(candidate.category)) {
          const removedCat = finalRecipes[i].category;
          const sameCatCount = finalRecipes.filter(r => r.category === removedCat).length;
          if (sameCatCount > 1) {
            finalRecipes[i] = candidate;
            uniqueCategories.add(candidate.category);
            selectedIds.add(candidate.id);
            break;
          }
        }
      }
    }
  }

  const recipes = finalRecipes.map(sr => buildRecipeFromRow(sr.row, currentUserId));

  const allUserTags = [...new Set([...favoriteTags, ...viewHistoryTags])];
  let reason = '为你推荐';
  if (isColdStart && !currentUserId) {
    reason = '时令精选 + 热门推荐';
  } else if (isColdStart) {
    reason = '根据时令为你探索新口味';
  } else if (allUserTags.length > 0) {
    const topTags = allUserTags.slice(0, 3).join('、');
    reason = `基于你的口味推荐 (${topTags})`;
  }

  res.json({
    success: true,
    data: {
      recipes,
      reason,
      userTags: allUserTags,
      isColdStart,
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
