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

interface CandidateRow {
  row: any;
  tags: string[];
  favTagMatch: number;
  viewTagMatch: number;
  isSeasonalCategory: boolean;
  isSeasonalTag: boolean;
  isViewed: boolean;
}

interface ScoredCandidate {
  row: any;
  score: number;
  tagRelScore: number;
  seasonalScore: number;
  qualityScore: number;
  freshScore: number;
}

const WEIGHT_PROFILES = {
  rich:   { wTagRel: 0.50, wSeasonal: 0.15, wQuality: 0.20, wFresh: 0.15 },
  sparse: { wTagRel: 0.30, wSeasonal: 0.30, wQuality: 0.25, wFresh: 0.15 },
  cold:   { wTagRel: 0.00, wSeasonal: 0.40, wQuality: 0.35, wFresh: 0.25 },
};

function getWeightProfile(tagCount: number) {
  if (tagCount >= 4) return WEIGHT_PROFILES.rich;
  if (tagCount >= 1) return WEIGHT_PROFILES.sparse;
  return WEIGHT_PROFILES.cold;
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map(v => (v - min) / (max - min));
}

function computeScores(
  candidates: CandidateRow[],
  weights: typeof WEIGHT_PROFILES.rich,
  maxFavMatch: number,
  maxViewMatch: number,
): ScoredCandidate[] {
  const raw: number[] = candidates.map(c => {
    const favNorm = maxFavMatch > 0 ? c.favTagMatch / maxFavMatch : 0;
    const viewNorm = maxViewMatch > 0 ? c.viewTagMatch / maxViewMatch : 0;
    return favNorm * 2.0 + viewNorm * 1.0;
  });
  const tagRelScores = normalize(raw);

  const seasonalScores = candidates.map(c =>
    (c.isSeasonalCategory ? 0.6 : 0) + (c.isSeasonalTag ? 0.4 : 0)
  );

  const qualityRatings = normalize(candidates.map(c => c.row.rating || 0));
  const qualityViews = normalize(candidates.map(c => c.row.view_count || 0));
  const qualityScores = candidates.map((_, i) =>
    qualityRatings[i] * 0.7 + qualityViews[i] * 0.3
  );

  const freshScores = candidates.map(c => c.isViewed ? 0.1 : 1.0);

  return candidates.map((c, i) => {
    const score =
      weights.wTagRel * tagRelScores[i] +
      weights.wSeasonal * seasonalScores[i] +
      weights.wQuality * qualityScores[i] +
      weights.wFresh * freshScores[i];
    return { row: c.row, score, tagRelScore: tagRelScores[i], seasonalScore: seasonalScores[i], qualityScore: qualityScores[i], freshScore: freshScores[i] };
  });
}

function diversityRerank(
  candidates: ScoredCandidate[],
  recipeTagsMap: Map<number, string[]>,
  targetCount: number,
  maxPerCategory: number,
  tagOverlapPenalty: number,
): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
  const categoryCount: Record<string, number> = {};
  const selectedTagSet = new Set<string>();

  const remaining = [...candidates].sort((a, b) => b.score - a.score);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = -1;
    let bestAdjScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const cat = c.row.category as string;
      const catCount = categoryCount[cat] || 0;

      if (catCount >= maxPerCategory) continue;

      const tags = recipeTagsMap.get(c.row.id) || [];
      const overlapCount = tags.filter(t => selectedTagSet.has(t)).length;
      const overlapRatio = selectedTagSet.size > 0 ? overlapCount / selectedTagSet.size : 0;
      const penalty = overlapRatio * tagOverlapPenalty;
      const adjScore = c.score - penalty;

      if (adjScore > bestAdjScore) {
        bestAdjScore = adjScore;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;

    const chosen = remaining.splice(bestIdx, 1)[0];
    selected.push(chosen);
    const cat = chosen.row.category as string;
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    const tags = recipeTagsMap.get(chosen.row.id) || [];
    for (const t of tags) selectedTagSet.add(t);
  }

  return selected;
}

router.get('/personalized', (req: Request, res: Response) => {
  const currentUserId = getUserIdFromHeader(req);
  const currentMonth = new Date().getMonth() + 1;
  const seasonalCategories = SEASONAL_CATEGORIES[currentMonth] || [];
  const seasonalTags = SEASONAL_TAGS[currentMonth] || [];
  const TARGET_COUNT = 12;

  let favoriteTags: string[] = [];
  let viewHistoryTags: string[] = [];
  const viewedIds = new Set<number>();

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
      SELECT recipe_id FROM view_history WHERE user_id = ?
    `).all(currentUserId) as any[];
    for (const r of viewedRows) viewedIds.add(r.recipe_id);
  }

  const allTags = [...new Set([...favoriteTags, ...viewHistoryTags])];
  const weights = getWeightProfile(allTags.length);

  const candidateMap = new Map<number, CandidateRow>();

  const favTagSet = new Set(favoriteTags);
  const viewTagSet = new Set(viewHistoryTags);
  const seasonalCatSet = new Set(seasonalCategories);
  const seasonalTagSet = new Set(seasonalTags);

  const mergeRow = (row: any) => {
    const id = row.id as number;
    if (candidateMap.has(id)) return;

    const rowTags = db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ?').all(id).map((t: any) => t.tag);
    const favMatch = rowTags.filter(t => favTagSet.has(t)).length;
    const viewMatch = rowTags.filter(t => viewTagSet.has(t)).length;
    const isSeasonalCat = seasonalCatSet.has(row.category);
    const isSeasonalTag = rowTags.some(t => seasonalTagSet.has(t));

    candidateMap.set(id, {
      row,
      tags: rowTags,
      favTagMatch: favMatch,
      viewTagMatch: viewMatch,
      isSeasonalCategory: isSeasonalCat,
      isSeasonalTag,
      isViewed: viewedIds.has(id),
    });
  };

  if (favoriteTags.length > 0) {
    const ph = favoriteTags.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${ph})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT 30
    `).all(...favoriteTags) as any[];
    rows.forEach(mergeRow);
  }

  if (viewHistoryTags.length > 0) {
    const ph = viewHistoryTags.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${ph})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT 20
    `).all(...viewHistoryTags) as any[];
    rows.forEach(mergeRow);
  }

  if (seasonalCategories.length > 0) {
    const ph = seasonalCategories.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT * FROM recipes
      WHERE category IN (${ph})
      ORDER BY rating DESC, view_count DESC
      LIMIT 15
    `).all(...seasonalCategories) as any[];
    rows.forEach(mergeRow);
  }

  if (seasonalTags.length > 0) {
    const ph = seasonalTags.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN recipe_tags rt ON r.id = rt.recipe_id
      WHERE rt.tag IN (${ph})
      GROUP BY r.id
      ORDER BY r.rating DESC, r.view_count DESC
      LIMIT 15
    `).all(...seasonalTags) as any[];
    rows.forEach(mergeRow);
  }

  {
    const rows = db.prepare(`
      SELECT * FROM recipes
      ORDER BY rating DESC, view_count DESC
      LIMIT 15
    `).all() as any[];
    rows.forEach(mergeRow);
  }

  const candidates = Array.from(candidateMap.values());

  const maxFavMatch = Math.max(1, ...candidates.map(c => c.favTagMatch));
  const maxViewMatch = Math.max(1, ...candidates.map(c => c.viewTagMatch));

  const scored = computeScores(candidates, weights, maxFavMatch, maxViewMatch);

  const recipeTagsMap = new Map<number, string[]>();
  for (const c of candidates) {
    recipeTagsMap.set(c.row.id, c.tags);
  }

  let result = diversityRerank(scored, recipeTagsMap, TARGET_COUNT, 3, 0.3);

  if (result.length < TARGET_COUNT) {
    const resultIds = new Set(result.map(r => r.row.id));
    const extraCandidates = candidates.filter(c => !resultIds.has(c.row.id));
    const extraScored = computeScores(extraCandidates, weights, maxFavMatch, maxViewMatch);
    const extraTagsMap = new Map<number, string[]>();
    for (const c of extraCandidates) {
      extraTagsMap.set(c.row.id, c.tags);
    }
    const extraResult = diversityRerank(extraScored, extraTagsMap, TARGET_COUNT - result.length, TARGET_COUNT, 0);
    result = [...result, ...extraResult];
  }

  const recipes = result.map(s => buildRecipeFromRow(s.row, currentUserId));

  let reason: string;
  if (!currentUserId) {
    reason = '时令热门推荐';
  } else if (allTags.length === 0) {
    const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    reason = `${monthNames[currentMonth - 1]}时令精选，为你发现好味道`;
  } else if (allTags.length <= 3) {
    reason = `根据你的兴趣推荐 (${allTags.slice(0, 3).join('、')})`;
  } else {
    reason = `基于你的口味推荐 (${allTags.slice(0, 3).join('、')})`;
  }

  res.json({
    success: true,
    data: {
      recipes,
      reason,
      userTags: currentUserId ? allTags : undefined,
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
