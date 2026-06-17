import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { Recipe } from '@shared/types';
import {
  Star,
  Eye,
  Heart,
  Sparkles,
  Refrigerator,
  Leaf,
  X,
  Plus,
  Search,
  ChefHat,
} from 'lucide-react';

type TabKey = 'personalized' | 'ingredients' | 'seasonal';

const tabConfig: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
  { key: 'personalized', label: '个性推荐', icon: Sparkles },
  { key: 'ingredients', label: '食材推荐', icon: Refrigerator },
  { key: 'seasonal', label: '时令推荐', icon: Leaf },
];

const commonIngredients = [
  '西红柿', '鸡蛋', '鸡胸肉', '牛肉', '土豆',
  '豆腐', '西兰花', '虾', '牛奶', '面粉',
];

const monthNames = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

interface RecipeWithReason extends Recipe {
  reason?: string;
}

interface RecipeWithMatch extends Recipe {
  matchPercentage?: number;
}

function RecipeCardBase({
  recipe,
  extra,
  onFavorite,
}: {
  recipe: Recipe;
  extra?: React.ReactNode;
  onFavorite?: (id: number) => void;
}) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="group block no-underline">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-orange-50">
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={recipe.coverImage}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="px-2.5 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
              {recipe.category}
            </span>
            {extra}
          </div>
          {onFavorite && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFavorite(recipe.id);
              }}
              className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
            >
              <Heart
                className={`w-4 h-4 ${recipe.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
              />
            </button>
          )}
          <div className="absolute bottom-3 right-3">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              recipe.difficulty === '入门' ? 'bg-green-100 text-green-700' :
              recipe.difficulty === '中等' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {recipe.difficulty}
            </span>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-800 mb-2 truncate group-hover:text-orange-600 transition-colors">
            {recipe.title}
          </h3>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              {recipe.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {recipe.viewCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Recommend() {
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('personalized');
  const [personalized, setPersonalized] = useState<RecipeWithReason[]>([]);
  const [personalizedReason, setPersonalizedReason] = useState('');
  const [seasonal, setSeasonal] = useState<Recipe[]>([]);
  const [seasonalInfo, setSeasonalInfo] = useState<{ monthName: string; reason: string }>({ monthName: '', reason: '' });
  const [ingredientResults, setIngredientResults] = useState<RecipeWithMatch[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ingredientLoading, setIngredientLoading] = useState(false);

  const fetchPersonalized = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.recommendations.personalized() as any;
      setPersonalized(data.recipes || []);
      setPersonalizedReason(data.reason || '');
    } catch {
      setPersonalized([]);
      setPersonalizedReason('');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSeasonal = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.recommendations.seasonal() as any;
      setSeasonal(data.recipes || []);
      setSeasonalInfo({ monthName: data.monthName || '', reason: data.reason || '' });
    } catch {
      setSeasonal([]);
      setSeasonalInfo({ monthName: '', reason: '' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'personalized' && isAuthenticated) {
      fetchPersonalized();
    } else if (activeTab === 'seasonal') {
      fetchSeasonal();
    }
  }, [activeTab, isAuthenticated, fetchPersonalized, fetchSeasonal]);

  const addIngredient = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients((prev) => [...prev, trimmed]);
    }
    setIngredientInput('');
  };

  const removeIngredient = (name: string) => {
    setIngredients((prev) => prev.filter((i) => i !== name));
  };

  const handleIngredientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIngredient(ingredientInput);
    }
  };

  const handleIngredientSearch = async () => {
    if (ingredients.length === 0) return;
    setIngredientLoading(true);
    try {
      const data = await api.recommendations.byIngredients(ingredients) as any;
      const recipes = (data.recipes || []).map((r: any) => ({
        ...r,
        matchPercentage: r.matchPercent,
      }));
      setIngredientResults(recipes);
    } catch {
      setIngredientResults([]);
    } finally {
      setIngredientLoading(false);
    }
  };

  const handleFavoriteToggle = async (recipeId: number) => {
    try {
      await api.users.favorite(recipeId);
      const toggleFavorite = (r: Recipe) =>
        r.id === recipeId ? { ...r, isFavorite: !r.isFavorite } : r;
      setPersonalized((prev) => prev.map(toggleFavorite) as RecipeWithReason[]);
      setSeasonal((prev) => prev.map(toggleFavorite));
      setIngredientResults((prev) => prev.map(toggleFavorite) as RecipeWithMatch[]);
    } catch {
    }
  };

  const currentMonth = seasonalInfo.monthName || monthNames[new Date().getMonth()];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <ChefHat className="w-7 h-7 text-orange-500" />
          智能推荐
        </h1>
        <p className="text-gray-500 mt-1">为你精选的美味菜谱</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-50">
        <div className="flex border-b border-orange-50">
          {tabConfig.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors relative ${
                activeTab === key
                  ? 'text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {activeTab === key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'personalized' && (
            <>
              {!isAuthenticated ? (
                <div className="text-center py-12 text-gray-400">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>请先登录以获取个性化推荐</p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : personalized.length > 0 ? (
                <div className="space-y-4">
                  {personalizedReason && (
                    <p className="text-sm text-orange-600 font-medium">💡 {personalizedReason}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {personalized.map((recipe) => (
                      <RecipeCardBase key={recipe.id} recipe={recipe} onFavorite={handleFavoriteToggle} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>暂无推荐，多浏览菜谱以获取个性化推荐</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'ingredients' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={handleIngredientKeyDown}
                    placeholder="输入食材名称，按回车添加"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={() => addIngredient(ingredientInput)}
                    className="px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ingredients.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                      >
                        {name}
                        <button onClick={() => removeIngredient(name)} className="hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-400 py-1">常用食材：</span>
                  {commonIngredients.map((name) => (
                    <button
                      key={name}
                      onClick={() => addIngredient(name)}
                      disabled={ingredients.includes(name)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        ingredients.includes(name)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleIngredientSearch}
                  disabled={ingredients.length === 0 || ingredientLoading}
                  className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                    ingredients.length === 0 || ingredientLoading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  推荐菜谱
                </button>
              </div>

              {ingredientLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : ingredientResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ingredientResults.map((recipe) => (
                    <RecipeCardBase
                      key={recipe.id}
                      recipe={recipe}
                      onFavorite={handleFavoriteToggle}
                      extra={
                        recipe.matchPercentage != null ? (
                          <span className="px-2.5 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                            {recipe.matchPercentage}%匹配
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              ) : ingredients.length > 0 && !ingredientLoading ? (
                <div className="text-center py-12 text-gray-400">
                  <Refrigerator className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>点击"推荐菜谱"开始搜索</p>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'seasonal' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-6 px-1">
                    <Leaf className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700 font-medium">{currentMonth}时令推荐</span>
                    <span className="text-gray-400 text-sm">— 顺应时节，品尝当季美味</span>
                  </div>
                  {seasonal.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {seasonal.map((recipe) => (
                        <RecipeCardBase key={recipe.id} recipe={recipe} onFavorite={handleFavoriteToggle} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Leaf className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>暂无时令推荐</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
