import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  X,
  Save,
  Download,
  Trash2,
  ShoppingCart,
  BarChart3,
  UtensilsCrossed,
} from 'lucide-react';
import type { MealPlanItem, Recipe, Ingredient } from '@shared/types';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useAuthStore } from '@/stores/authStore';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
const MEAL_LABELS = ['早餐', '午餐', '晚餐'];

export default function MealPlanPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    plan,
    planId,
    weekStartDate,
    templates,
    loading,
    fetchCurrentPlan,
    updateItem,
    fetchTemplates,
    saveTemplate,
    deleteTemplate,
    applyTemplate,
  } = useMealPlanStore();

  const [editingCell, setEditingCell] = useState<{
    day: number;
    mealType: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customIngredients, setCustomIngredients] = useState('');
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentPlan();
      fetchTemplates();
    }
  }, [isAuthenticated, fetchCurrentPlan, fetchTemplates]);

  const searchRecipes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/recipes?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.recipes);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) searchRecipes(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchRecipes]);

  const getWeekRange = () => {
    if (!weekStartDate) return '';
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const handleSelectRecipe = async (recipe: Recipe) => {
    if (!editingCell) return;
    await updateItem(editingCell.day, editingCell.mealType, {
      recipeId: recipe.id,
      recipe,
    });
    setEditingCell(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleCustomSave = async () => {
    if (!editingCell || !customTitle.trim()) return;
    const ingredients = customIngredients
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        const parts = l.trim().split(/\s+/);
        return { name: parts[0] || l.trim(), amount: Number(parts[1]) || 1, unit: parts[2] || '份' };
      });
    await updateItem(editingCell.day, editingCell.mealType, {
      customTitle: customTitle.trim(),
      customIngredients: ingredients,
    });
    setEditingCell(null);
    setCustomTitle('');
    setCustomIngredients('');
  };

  const handleClearCell = async () => {
    if (!editingCell) return;
    await updateItem(editingCell.day, editingCell.mealType, {
      recipeId: null,
      recipe: null,
      customTitle: null,
      customIngredients: null,
    });
    setEditingCell(null);
    setSearchQuery('');
    setSearchResults([]);
    setCustomTitle('');
    setCustomIngredients('');
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    await saveTemplate(templateName.trim(), plan);
    setShowSaveTemplate(false);
    setTemplateName('');
  };

  const openCell = (day: number, mealType: string) => {
    setEditingCell({ day, mealType });
    const item = plan[day]?.[mealType as keyof typeof plan[typeof day]] as
      | MealPlanItem
      | undefined;
    if (item?.customTitle) {
      setCustomTitle(item.customTitle);
      setCustomIngredients(
        (item.customIngredients || []).map((ing: Ingredient) => `${ing.name} ${ing.amount} ${ing.unit}`).join('\n')
      );
    } else {
      setCustomTitle('');
      setCustomIngredients('');
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const getCellItem = (day: number, mealType: string): MealPlanItem | undefined => {
    return plan[day]?.[mealType as 'breakfast' | 'lunch' | 'dinner'] as
      | MealPlanItem
      | undefined;
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <UtensilsCrossed className="w-16 h-16 mb-4" />
        <p className="text-lg">请先登录以查看膳食计划</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">每周膳食计划</h1>
          <p className="text-sm text-gray-500 mt-1">
            {getWeekRange() || '加载中...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/shopping')}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            采购清单
          </button>
          <button
            onClick={() => navigate('/nutrition')}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            营养分析
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1">
              <div />
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-sm font-semibold text-gray-600 py-2 bg-orange-50 rounded-lg"
                >
                  {label}
                </div>
              ))}

              {MEAL_TYPES.map((mealType, mealIdx) => (
                <Fragment key={mealType}>
                  <div
                    key={mealType}
                    className="flex items-center justify-center text-sm font-semibold text-gray-600 bg-orange-50 rounded-lg px-2"
                  >
                    {MEAL_LABELS[mealIdx]}
                  </div>
                  {DAYS.map((day) => {
                    const item = getCellItem(day, mealType);
                    return (
                      <div
                        key={`${day}-${mealType}`}
                        className="min-h-[80px] bg-white border border-gray-100 rounded-lg p-2 hover:border-orange-200 hover:shadow-sm transition-all cursor-pointer group"
                        onClick={() => openCell(day, mealType)}
                      >
                        {item?.recipe ? (
                          <div className="flex items-center gap-2 h-full">
                            <img
                              src={item.recipe.coverImage}
                              alt={item.recipe.title}
                              className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                            />
                            <span className="text-xs text-gray-700 line-clamp-2 leading-tight">
                              {item.recipe.title}
                            </span>
                          </div>
                        ) : item?.customTitle ? (
                          <div className="flex items-center gap-2 h-full">
                            <div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
                              <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                            </div>
                            <span className="text-xs text-gray-700 line-clamp-2 leading-tight">
                              {item.customTitle}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Plus className="w-5 h-5 text-gray-300 group-hover:text-orange-400 transition-colors" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={() => setShowSaveTemplate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Save className="w-4 h-4" />
          保存为模板
        </button>
        <button
          onClick={() => setShowTemplateList(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          加载模板
        </button>
      </div>

      {editingCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setEditingCell(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {DAY_LABELS[editingCell.day - 1]} - {MEAL_LABELS[MEAL_TYPES.indexOf(editingCell.mealType as typeof MEAL_TYPES[number])]}
              </h3>
              <button
                onClick={() => setEditingCell(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  搜索菜谱
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="输入菜谱名称..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                  />
                </div>
                {searching && (
                  <p className="text-xs text-gray-400 mt-1">搜索中...</p>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-100 rounded-lg max-h-40 overflow-y-auto">
                    {searchResults.map((recipe) => (
                      <button
                        key={recipe.id}
                        onClick={() => handleSelectRecipe(recipe)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 transition-colors text-left"
                      >
                        <img
                          src={recipe.coverImage}
                          alt={recipe.title}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700">{recipe.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-gray-400">或自定义</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  自定义餐名
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="例如：水果沙拉"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  自定义食材（每行一个：名称 数量 单位）
                </label>
                <textarea
                  value={customIngredients}
                  onChange={(e) => setCustomIngredients(e.target.value)}
                  placeholder={'苹果 2 个\n酸奶 200 ml'}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCustomSave}
                  disabled={!customTitle.trim()}
                  className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存自定义
                </button>
                {getCellItem(editingCell.day, editingCell.mealType) && (
                  <button
                    onClick={handleClearCell}
                    className="px-4 py-2 bg-red-50 text-red-500 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSaveTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowSaveTemplate(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4">保存为模板</h3>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="输入模板名称"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplateList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowTemplateList(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">加载模板</h3>
              <button
                onClick={() => setShowTemplateList(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">暂无保存的模板</p>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between px-3 py-3 border border-gray-100 rounded-lg hover:border-orange-200 transition-colors"
                  >
                    <button
                      onClick={async () => {
                        await applyTemplate(tpl.id);
                        setShowTemplateList(false);
                      }}
                      className="text-sm text-gray-700 font-medium hover:text-orange-600 text-left flex-1"
                    >
                      {tpl.name}
                    </button>
                    <button
                      onClick={() => deleteTemplate(tpl.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
