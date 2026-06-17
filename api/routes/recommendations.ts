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

interface CandidateRecipe {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  cook_time: number;
  rating: number;
  rating_count: number;
  view_count: number;
  cover_image: string;
  author_id: number;
  created_at: string;
  servings: number;
  tags: string[];
  score: number;
  tagMatchScore: number;
  seasonalScore: number;
  qualityScore: number;
  noveltyScore: number;
  source: string[];
}

const REC_LIMIT = 12;
const CANDIDATE_MULTIPLIER = 3;

const WEIGHTS = {
  favoriteTag: 2.5,
  viewTag: 1.2,
  seasonalCategory: 1.5,
  seasonalTag: 1.0,
  quality: 1.0,
  novelty: 0.8,
};

const DIVERSITY = {
  maxPerCategory: 4,
  minCategories: 3,
  tagDiversityThreshold: 0.6,
};

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function getTagWeights(
  favoriteTags: string[],
  viewHistoryTags: string[]
): Record<string, number> {
  const weights: Record<string, number> = {};
  
  for (const tag of favoriteTags) {
    weights[tag] = (weights[tag] || 0) + WEIGHTS.favoriteTag;
  }
  
  for (const tag of viewHistoryTags) {
    weights[tag] = (weights[tag] || 0) + WEIGHTS.viewTag;
  }
  
  return weights;
}

function calculateTagMatchScore(
  recipeTags: string[],
  tagWeights: Record<string, number>
): number {
  let score = 0;
  for (const tag of recipeTags) {
    if (tagWeights[tag]) {
      score += tagWeights[tag];
    }
  }
  return score;
}

function calculateSeasonalScore(
  category: string,
  tags: string[],
  seasonalCategories: string[],
  seasonalTags: string[]
): number {
  let score = 0;
  
  if (seasonalCategories.includes(category)) {
    score += WEIGHTS.seasonalCategory;
  }
  
  for (const tag of tags) {
    if (seasonalTags.includes(tag)) {
      score += WEIGHTS.seasonalTag;
    }
  }
  
  return score;
}

function fetchRecipesWithTags(recipeIds: number[]): Map<number, string[]> {
  if (recipeIds.length === 0) return new Map();
  
  const placeholders = recipeIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT recipe_id, tag FROM recipe_tags
    WHERE recipe_id IN (${placeholders})
  `).all(...recipeIds) as { recipe_id: number; tag: string }[];
  
  const tagMap = new Map<number, string[]>();
  for (const row of rows) {
    if (!tagMap.has(row.recipe_id)) {
      tagMap.set(row.recipe_id, []);
    }
    tagMap.get(row.recipe_id)!.push(row.tag);
  }
  
  return tagMap;
}

function buildCandidateRecipes(
  rows: any[],
  tagMap: Map<number, string[]>,
  viewedIds: Set<number>,
  tagWeights: Record<string, number>,
  seasonalCategories: string[],
  seasonalTags: string[],
  maxRating: number,
  maxViewCount: number,
  source: string
): CandidateRecipe[] {
  return rows.map(row => {
    const tags = tagMap.get(row.id) || [];
    const tagMatchScore = calculateTagMatchScore(tags, tagWeights);
    const seasonalScore = calculateSeasonalScore(row.category, tags, seasonalCategories, seasonalTags);
    const qualityScore = normalize(row.rating, 0, maxRating) * 0.6 + normalize(row.view_count, 0, maxViewCount) * 0.4;
    const noveltyScore = viewedIds.has(row.id) ? 0 : 1;
    
    const score = 
      tagMatchScore * 1.0 +
      seasonalScore * 1.0 +
      qualityScore * WEIGHTS.quality +
      noveltyScore * WEIGHTS.novelty;
    
    return {
      ...row,
      tags,
      score,
      tagMatchScore,
      seasonalScore,
      qualityScore,
      noveltyScore,
      source: [source],
    };
  });
}

function mergeCandidates(existing: Map<number, CandidateRecipe>, newCandidates: CandidateRecipe[]): Map<number, CandidateRecipe> {
  for (const candidate of newCandidates) {
    if (existing.has(candidate.id)) {
      const existingItem = existing.get(candidate.id)!;
      existingItem.score = Math.max(existingItem.score, candidate.score);
      existingItem.tagMatchScore = Math.max(existingItem.tagMatchScore, candidate.tagMatchScore);
      existingItem.seasonalScore = Math.max(existingItem.seasonalScore, candidate.seasonalScore);
      existingItem.source = [...new Set([...existingItem.source, ...candidate.source])];
    } else {
      existing.set(candidate.id, { ...candidate });
    }
  }
  return existing;
}

function diversityReRank(candidates: CandidateRecipe[], limit: number): CandidateRecipe[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: CandidateRecipe[] = [];
  const categoryCount: Record<string, number> = {};
  const selectedTagSet = new Set<string>();
  
  for (const candidate of sorted) {
    if (selected.length >= limit) break;
    
    const category = candidate.category;
    const currentCategoryCount = categoryCount[category] || 0;
    
    if (currentCategoryCount >= DIVERSITY.maxPerCategory) continue;
    
    let tagOverlap = 0;
    for (const tag of candidate.tags) {
      if (selectedTagSet.has(tag)) tagOverlap++;
    }
    const tagDiversityRatio = candidate.tags.length > 0 
      ? 1 - (tagOverlap / candidate.tags.length)
      : 1;
    
    if (selected.length > 0 && tagDiversityRatio < DIVERSITY.tagDiversityThreshold) {
      const hasLowerScoreCandidate = sorted.some(c => 
        c.id !== candidate.id && 
        !selected.some(s => s.id === c.id) && 
        (categoryCount[c.category] || 0) < DIVERSITY.maxPerCategory
      );
      if (hasLowerScoreCandidate) continue;
    }
    
    selected.push(candidate);
    categoryCount[category] = currentCategoryCount + 1;
    for (const tag of candidate.tags) {
      selectedTagSet.add(tag);
    }
  }
  
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map(s => s.id));
    for (const candidate of sorted) {
      if (selected.length >= limit) break;
      if (!selectedIds.has(candidate.id)) {
        selected.push(candidate);
        selectedIds.add(candidate.id);
      }
    }
  }
  
  return selected;
}

function getColdStartReason(
  hasUserData: boolean,
  tagCount: number,
  seasonalCategories: string[]
): string {
  if (!hasUserData) {
    return `精选时令推荐 · ${seasonalCategories.slice(0, 2).join('、')}`;
  }
  if (tagCount === 0) {
    return '探索发现 · 时令与热门精选';
  }
  if (tagCount < 3) {
    return '为你推荐 · 结合时令与口味偏好';
  }
  return '';
}

router.get('/personalized', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const currentMonth = new Date().getMonth() + 1;
  const seasonalCategories = SEASONAL_CATEGORIES[currentMonth] || [];
  const seasonalTags = SEASONAL_TAGS[currentMonth] || [];
  
  const candidateLimit = REC_LIMIT * CANDIDATE_MULTIPLIER;
  
  const maxStats = db.prepare(`
    SELECT MAX(rating) as max_rating, MAX(view_count) as max_view_count
    FROM recipes
  `).get() as { max_rating: number; max_view_count: number };
  const maxRating = maxStats.max_rating || 5;
  const maxViewCount = maxStats.max_view_count || 1000;
  
  let favoriteTags: string[] = [];
  let viewHistoryTags: string[] = [];
  let viewedIds = new Set<number>();
  let favoriteIds = new Set<number>();
  
  if (currentUserId) {
    favoriteTags = db.prepare(`
      SELECT DISTINCT rt.tag FROM recipe_tags rt
      INNER JOIN favorites f ON rt.recipe_id = f.recipe_id
      WHERE f.user_id = ?
    `).all(currentUserId).map((r: any) => r.tag);
    
    viewHistoryTags = db.prepare(`
      SELECT DISTINCT rt.tag FROM recipe_tags rt
      INNER JOIN view_history vh ON rt.recipe_id = vh.recipe_id
      WHERE vh.user_id = ?
    `).all(currentUserId).map((r: any) => r.tag);
    
    const viewedRows = db.prepare(`
      SELECT DISTINCT recipe_id FROM view_history WHERE user_id = ?
    `).all(currentUserId) as { recipe_id: number }[];
    viewedIds = new Set(viewedRows.map(r => r.recipe_id));
    
    const favoriteRows = db.prepare(`
      SELECT DISTINCT recipe_id FROM favorites WHERE user_id = ?
    `).all(currentUserId) as { recipe_id: number }[];
    favoriteIds = new Set(favoriteRows.map(r => r.recipe_id));
  }
  
  const allUserTags = [...new Set([...favoriteTags, ...viewHistoryTags])];
  const tagWeights = getTagWeights(favoriteTags, viewHistoryTags);
  const hasEnoughTags = allUserTags.length >= 3;
  
  const candidatesMap = new Map<number, CandidateRecipe>();
  
  if (favoriteTags.length > 0) {
    const placeholders = favoriteTags.map(() => '?').join(',');
    const excludeIds = favoriteIds.size > 0 ? [...favoriteIds] : [0];
    const excludePlaceholders = excludeIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${placeholders})
      AND r.id NOT IN (${excludePlaceholders})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT ?
    `).all(...favoriteTags, ...excludeIds, candidateLimit) as any[];
    
    const recipeIds = rows.map(r => r.id);
    const tagMap = fetchRecipesWithTags(recipeIds);
    const candidates = buildCandidateRecipes(
      rows, tagMap, viewedIds, tagWeights,
      seasonalCategories, seasonalTags, maxRating, maxViewCount,
      '收藏标签'
    );
    mergeCandidates(candidatesMap, candidates);
  }
  
  if (viewHistoryTags.length > 0) {
    const placeholders = viewHistoryTags.map(() => '?').join(',');
    const excludeIds = viewedIds.size > 0 ? [...viewedIds] : [0];
    const excludePlaceholders = excludeIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${placeholders})
      AND r.id NOT IN (${excludePlaceholders})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT ?
    `).all(...viewHistoryTags, ...excludeIds, candidateLimit) as any[];
    
    const recipeIds = rows.map(r => r.id);
    const tagMap = fetchRecipesWithTags(recipeIds);
    const candidates = buildCandidateRecipes(
      rows, tagMap, viewedIds, tagWeights,
      seasonalCategories, seasonalTags, maxRating, maxViewCount,
      '浏览标签'
    );
    mergeCandidates(candidatesMap, candidates);
  }
  
  if (seasonalCategories.length > 0) {
    const placeholders = seasonalCategories.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.* FROM recipes r
      WHERE r.category IN (${placeholders})
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT ?
    `).all(...seasonalCategories, candidateLimit) as any[];
    
    const recipeIds = rows.map(r => r.id);
    const tagMap = fetchRecipesWithTags(recipeIds);
    const candidates = buildCandidateRecipes(
      rows, tagMap, viewedIds, tagWeights,
      seasonalCategories, seasonalTags, maxRating, maxViewCount,
      '时令类别'
    );
    mergeCandidates(candidatesMap, candidates);
  }
  
  if (seasonalTags.length > 0) {
    const placeholders = seasonalTags.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${placeholders})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT ?
    `).all(...seasonalTags, candidateLimit) as any[];
    
    const recipeIds = rows.map(r => r.id);
    const tagMap = fetchRecipesWithTags(recipeIds);
    const candidates = buildCandidateRecipes(
      rows, tagMap, viewedIds, tagWeights,
      seasonalCategories, seasonalTags, maxRating, maxViewCount,
      '时令标签'
    );
    mergeCandidates(candidatesMap, candidates);
  }
  
  const popularRows = db.prepare(`
    SELECT * FROM recipes
    ORDER BY rating DESC, view_count DESC
    LIMIT ?
  `).all(candidateLimit) as any[];
  
  const popularIds = popularRows.map(r => r.id);
  const popularTagMap = fetchRecipesWithTags(popularIds);
  const popularCandidates = buildCandidateRecipes(
    popularRows, popularTagMap, viewedIds, tagWeights,
    seasonalCategories, seasonalTags, maxRating, maxViewCount,
    '热门推荐'
  );
  mergeCandidates(candidatesMap, popularCandidates);
  
  let allCandidates = Array.from(candidatesMap.values());
  
  if (favoriteIds.size > 0) {
    allCandidates = allCandidates.filter(c => !favoriteIds.has(c.id));
  }
  
  if (!hasEnoughTags && allCandidates.length > 0) {
    const tagWeightMultiplier = allUserTags.length === 0 ? 0 : 0.5;
    const seasonalMultiplier = 1.5;
    const qualityMultiplier = 1.3;
    
    allCandidates = allCandidates.map(c => ({
      ...c,
      score: 
        c.tagMatchScore * tagWeightMultiplier +
        c.seasonalScore * seasonalMultiplier +
        c.qualityScore * qualityMultiplier +
        c.noveltyScore * WEIGHTS.novelty,
    }));
  }
  
  const reRanked = diversityReRank(allCandidates, REC_LIMIT);
  
  let finalRecipes = reRanked.map(row => buildRecipeFromRow(row, currentUserId));
  
  if (finalRecipes.length < REC_LIMIT) {
    const existingIds = new Set(finalRecipes.map(r => r.id));
    const remainingIds = allCandidates
      .filter(c => !existingIds.has(c.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, REC_LIMIT - finalRecipes.length);
    
    const moreRecipes = remainingIds.map(row => buildRecipeFromRow(row, currentUserId));
    finalRecipes = [...finalRecipes, ...moreRecipes];
  }
  
  const hasUserData = !!currentUserId;
  const coldStartReason = getColdStartReason(hasUserData, allUserTags.length, seasonalCategories);
  const reason = hasEnoughTags 
    ? `基于你的口味推荐 (${allUserTags.slice(0, 3).join('、')})`
    : coldStartReason || '为你推荐';
  
  res.json({
    success: true,
    data: {
      recipes: finalRecipes.slice(0, REC_LIMIT),
      reason,
      userTags: allUserTags,
      seasonalCategories,
      seasonalTags,
      strategy: hasEnoughTags ? 'hybrid_personalized' : 'cold_start_hybrid',
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
