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

const RECOMMEND_CONFIG = {
  RESULT_COUNT: 12,
  MIN_TAG_COUNT_FOR_PERSONALIZED: 2,
  WEIGHTS: {
    favoriteTagMatch: 0.35,
    viewTagMatch: 0.20,
    seasonalMatch: 0.15,
    rating: 0.15,
    viewCount: 0.10,
    novelty: 0.05,
  },
  CATEGORY_DIVERSITY_RATIO: 0.35,
};

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function getUserTagStats(userId: number): {
  favoriteTags: Map<string, number>;
  viewTags: Map<string, number>;
  allTags: string[];
  totalFavorites: number;
  totalViews: number;
} {
  const favoriteTagRows = db.prepare(`
    SELECT rt.tag, COUNT(*) as cnt
    FROM recipe_tags rt
    INNER JOIN favorites f ON rt.recipe_id = f.recipe_id
    WHERE f.user_id = ?
    GROUP BY rt.tag
    ORDER BY cnt DESC
  `).all(userId) as { tag: string; cnt: number }[];

  const viewTagRows = db.prepare(`
    SELECT rt.tag, COUNT(*) as cnt
    FROM recipe_tags rt
    INNER JOIN view_history vh ON rt.recipe_id = vh.recipe_id
    WHERE vh.user_id = ?
    GROUP BY rt.tag
    ORDER BY cnt DESC
  `).all(userId) as { tag: string; cnt: number }[];

  const favoriteTags = new Map<string, number>();
  const viewTags = new Map<string, number>();
  const allTagsSet = new Set<string>();

  let totalFavorites = 0;
  let totalViews = 0;

  for (const row of favoriteTagRows) {
    favoriteTags.set(row.tag, row.cnt);
    allTagsSet.add(row.tag);
    totalFavorites += row.cnt;
  }

  for (const row of viewTagRows) {
    viewTags.set(row.tag, row.cnt);
    allTagsSet.add(row.tag);
    totalViews += row.cnt;
  }

  return {
    favoriteTags,
    viewTags,
    allTags: Array.from(allTagsSet),
    totalFavorites,
    totalViews,
  };
}

function getGlobalStats(): {
  maxViewCount: number;
  minViewCount: number;
  maxRating: number;
  minRating: number;
} {
  const row = db.prepare(`
    SELECT 
      MAX(view_count) as max_view,
      MIN(view_count) as min_view,
      MAX(rating) as max_rating,
      MIN(rating) as min_rating
    FROM recipes
  `).get() as any;

  return {
    maxViewCount: row.max_view || 100,
    minViewCount: row.min_view || 0,
    maxRating: row.max_rating || 5,
    minRating: row.min_rating || 0,
  };
}

interface ScoredRecipe {
  id: number;
  title: string;
  category: string;
  rating: number;
  viewCount: number;
  tags: string[];
  score: number;
  scoreBreakdown: {
    favoriteTagScore: number;
    viewTagScore: number;
    seasonalScore: number;
    ratingScore: number;
    viewScore: number;
    noveltyScore: number;
  };
  sources: string[];
}

function batchGetRecipeTags(recipeIds: number[]): Map<number, string[]> {
  if (recipeIds.length === 0) return new Map();
  
  const placeholders = recipeIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT recipe_id, tag FROM recipe_tags
    WHERE recipe_id IN (${placeholders})
    ORDER BY recipe_id
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

function batchGetViewedRecipes(userId: number, recipeIds: number[]): Set<number> {
  if (recipeIds.length === 0) return new Set();
  
  const placeholders = recipeIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT recipe_id FROM view_history
    WHERE user_id = ? AND recipe_id IN (${placeholders})
  `).all(userId, ...recipeIds) as { recipe_id: number }[];

  return new Set(rows.map(r => r.recipe_id));
}

function buildScoredRecipes(
  recipeRows: any[],
  tagMap: Map<number, string[]>,
  tagStats: ReturnType<typeof getUserTagStats>,
  seasonalTags: string[],
  seasonalCategories: string[],
  globalStats: ReturnType<typeof getGlobalStats>,
  viewedSet: Set<number>,
  source: string
): ScoredRecipe[] {
  const { favoriteTags, viewTags, totalFavorites, totalViews } = tagStats;
  const { maxViewCount, minViewCount, maxRating, minRating } = globalStats;
  const w = RECOMMEND_CONFIG.WEIGHTS;

  return recipeRows.map(row => {
    const tags = tagMap.get(row.id) || [];

    let favoriteMatchScore = 0;
    if (favoriteTags.size > 0 && totalFavorites > 0) {
      let weightedSum = 0;
      for (const tag of tags) {
        const cnt = favoriteTags.get(tag);
        if (cnt) {
          weightedSum += cnt / totalFavorites;
        }
      }
      favoriteMatchScore = Math.min(1, weightedSum * 2);
    }

    let viewMatchScore = 0;
    if (viewTags.size > 0 && totalViews > 0) {
      let weightedSum = 0;
      for (const tag of tags) {
        const cnt = viewTags.get(tag);
        if (cnt) {
          weightedSum += cnt / totalViews;
        }
      }
      viewMatchScore = Math.min(1, weightedSum * 2);
    }

    let seasonalScore = 0;
    if (seasonalTags.length > 0 || seasonalCategories.length > 0) {
      const tagMatches = tags.filter(t => seasonalTags.includes(t)).length;
      const categoryMatch = seasonalCategories.includes(row.category) ? 1 : 0;
      seasonalScore = (tagMatches / Math.max(1, seasonalTags.length) * 0.6) + (categoryMatch * 0.4);
    }

    const ratingScore = normalize(row.rating || 0, minRating, maxRating);
    const viewScore = normalize(row.view_count || 0, minViewCount, maxViewCount);
    const noveltyScore = viewedSet.has(row.id) ? 0 : 1;

    const score =
      favoriteMatchScore * w.favoriteTagMatch +
      viewMatchScore * w.viewTagMatch +
      seasonalScore * w.seasonalMatch +
      ratingScore * w.rating +
      viewScore * w.viewCount +
      noveltyScore * w.novelty;

    return {
      id: row.id,
      title: row.title,
      category: row.category,
      rating: row.rating || 0,
      viewCount: row.view_count || 0,
      tags,
      score,
      scoreBreakdown: {
        favoriteTagScore: favoriteMatchScore,
        viewTagScore: viewMatchScore,
        seasonalScore,
        ratingScore,
        viewScore,
        noveltyScore,
      },
      sources: [source],
    };
  });
}

function mergeCandidateRecipes(lists: ScoredRecipe[][]): ScoredRecipe[] {
  const recipeMap = new Map<number, ScoredRecipe>();

  for (const list of lists) {
    for (const recipe of list) {
      const existing = recipeMap.get(recipe.id);
      if (existing) {
        existing.sources = [...new Set([...existing.sources, ...recipe.sources])];
        existing.score = Math.max(existing.score, recipe.score);
      } else {
        recipeMap.set(recipe.id, { ...recipe });
      }
    }
  }

  return Array.from(recipeMap.values());
}

function diversityRerank(recipes: ScoredRecipe[], targetCount: number): ScoredRecipe[] {
  if (recipes.length <= targetCount) {
    return [...recipes].sort((a, b) => b.score - a.score);
  }

  const result: ScoredRecipe[] = [];
  const remaining = [...recipes].sort((a, b) => b.score - a.score);
  const categoryCount = new Map<string, number>();

  const totalCategories = new Set(recipes.map(r => r.category)).size;
  const maxPerCategory = Math.max(2, Math.ceil(targetCount / totalCategories));

  while (result.length < targetCount && remaining.length > 0) {
    let bestIndex = -1;
    let bestAdjustedScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const recipe = remaining[i];
      const catCount = categoryCount.get(recipe.category) || 0;

      let diversityPenalty = 0;
      if (catCount >= maxPerCategory) {
        diversityPenalty = 0.5;
      } else if (catCount > 0 && result.length > 0) {
        diversityPenalty = (catCount / maxPerCategory) * 0.2;
      }

      const tagOverlapPenalty = result.reduce((penalty, picked) => {
        const sharedTags = recipe.tags.filter(t => picked.tags.includes(t)).length;
        const totalTags = Math.max(1, recipe.tags.length + picked.tags.length - sharedTags);
        return penalty + (sharedTags / totalTags) * 0.05;
      }, 0);

      const adjustedScore = recipe.score - diversityPenalty - tagOverlapPenalty;

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      const picked = remaining.splice(bestIndex, 1)[0];
      result.push(picked);
      categoryCount.set(picked.category, (categoryCount.get(picked.category) || 0) + 1);
    } else {
      break;
    }
  }

  return result;
}

function getSeasonalData(month: number): { tags: string[]; categories: string[] } {
  return {
    tags: SEASONAL_TAGS[month] || [],
    categories: SEASONAL_CATEGORIES[month] || [],
  };
}

function generateReason(
  userId: number | null,
  tagStats: ReturnType<typeof getUserTagStats> | null,
  seasonalData: { tags: string[]; categories: string[] },
  finalRecipes: ScoredRecipe[]
): string {
  if (!userId) {
    return `精选推荐 · ${seasonalData.categories.slice(0, 2).join('、')}`;
  }

  if (!tagStats || tagStats.allTags.length === 0) {
    return `为你精选 · ${seasonalData.tags.slice(0, 2).join('、')}`;
  }

  const topTags = tagStats.allTags.slice(0, 3);
  if (tagStats.allTags.length < RECOMMEND_CONFIG.MIN_TAG_COUNT_FOR_PERSONALIZED) {
    return `探索发现 · 结合${topTags.join('、')}与时令`;
  }

  return `猜你喜欢 · 基于${topTags.join('、')}等口味`;
}

router.get('/personalized', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const currentMonth = new Date().getMonth() + 1;
  const seasonalData = getSeasonalData(currentMonth);
  const globalStats = getGlobalStats();
  const targetCount = RECOMMEND_CONFIG.RESULT_COUNT;

  const tagStats = currentUserId ? getUserTagStats(currentUserId) : null;
  const hasEnoughTags = tagStats && tagStats.allTags.length >= RECOMMEND_CONFIG.MIN_TAG_COUNT_FOR_PERSONALIZED;

  const emptyTagStats = {
    favoriteTags: new Map<string, number>(),
    viewTags: new Map<string, number>(),
    allTags: [],
    totalFavorites: 0,
    totalViews: 0,
  };

  const candidateRows: { rows: any[]; source: string; useTagStats: boolean }[] = [];

  if (tagStats && tagStats.favoriteTags.size > 0) {
    const favTags = Array.from(tagStats.favoriteTags.keys());
    const placeholders = favTags.map(() => '?').join(',');
    const favRows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${placeholders})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT ${targetCount * 2}
    `).all(...favTags) as any[];
    candidateRows.push({ rows: favRows, source: 'favorite', useTagStats: true });
  }

  if (tagStats && tagStats.viewTags.size > 0) {
    const viewTags = Array.from(tagStats.viewTags.keys());
    const placeholders = viewTags.map(() => '?').join(',');
    const viewRows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${placeholders})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT ${targetCount * 2}
    `).all(...viewTags) as any[];
    candidateRows.push({ rows: viewRows, source: 'view', useTagStats: true });
  }

  if (seasonalData.categories.length > 0) {
    const placeholders = seasonalData.categories.map(() => '?').join(',');
    const seasonalRows = db.prepare(`
      SELECT * FROM recipes
      WHERE category IN (${placeholders})
      ORDER BY rating DESC, view_count DESC
      LIMIT ${targetCount * 2}
    `).all(...seasonalData.categories) as any[];
    candidateRows.push({ rows: seasonalRows, source: 'seasonal', useTagStats: false });
  }

  const popularRows = db.prepare(`
    SELECT * FROM recipes
    ORDER BY view_count DESC, rating DESC
    LIMIT ${targetCount * 3}
  `).all() as any[];
  candidateRows.push({ rows: popularRows, source: 'popular', useTagStats: false });

  const allRecipeIdsSet = new Set<number>();
  const allRecipeRows: any[] = [];
  for (const { rows } of candidateRows) {
    for (const row of rows) {
      if (!allRecipeIdsSet.has(row.id)) {
        allRecipeIdsSet.add(row.id);
        allRecipeRows.push(row);
      }
    }
  }
  const allRecipeIds = Array.from(allRecipeIdsSet);

  const tagMap = batchGetRecipeTags(allRecipeIds);
  const viewedSet = currentUserId ? batchGetViewedRecipes(currentUserId, allRecipeIds) : new Set<number>();

  const candidates: ScoredRecipe[][] = [];
  for (const { rows, source, useTagStats } of candidateRows) {
    const stats = useTagStats && tagStats ? tagStats : emptyTagStats;
    candidates.push(buildScoredRecipes(rows, tagMap, stats, seasonalData.tags, seasonalData.categories, globalStats, viewedSet, source));
  }

  const mergedCandidates = mergeCandidateRecipes(candidates);

  let finalScored: ScoredRecipe[];

  if (currentUserId && mergedCandidates.length > targetCount) {
    const notViewed = mergedCandidates.filter(r => !viewedSet.has(r.id));
    if (notViewed.length >= targetCount * 0.6) {
      finalScored = diversityRerank(notViewed, targetCount);
    } else {
      finalScored = diversityRerank(mergedCandidates, targetCount);
    }
  } else {
    finalScored = diversityRerank(mergedCandidates, targetCount);
  }

  const reason = generateReason(currentUserId, tagStats, seasonalData, finalScored);

  const recipeRowMap = new Map<number, any>();
  for (const row of allRecipeRows) {
    recipeRowMap.set(row.id, row);
  }

  const recipes = finalScored.map(scored => {
    const row = recipeRowMap.get(scored.id) || {
      id: scored.id,
      title: scored.title,
      category: scored.category,
      rating: scored.rating,
      view_count: scored.viewCount,
    };
    return buildRecipeFromRow(row, currentUserId);
  });

  res.json({
    success: true,
    data: {
      recipes,
      reason,
      userTags: tagStats?.allTags || [],
      strategy: !currentUserId ? 'guest-curated' : hasEnoughTags ? 'hybrid-personalized' : 'light-personalized',
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
