import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, ChevronLeft, Loader2 } from 'lucide-react';
import { useRecipesStore } from '@/stores/recipesStore';
import { api } from '@/lib/api';
import type { Ingredient, RecipeStep, Nutrition } from '@shared/types';

const CATEGORIES = ['中餐', '西餐', '日料', '烘焙', '饮品', '汤羹'] as const;
const DIFFICULTIES = ['入门', '中等', '困难'] as const;
const UNITS = ['g', 'ml', '个', '片', '勺'] as const;
const TAG_OPTIONS = ['快手菜', '减脂', '高蛋白', '无麸质'] as const;

interface IngredientInput {
  name: string;
  amount: string;
  unit: string;
}

interface StepInput {
  description: string;
  imageUrl: string;
}

export default function CreateRecipe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { createRecipe, updateRecipe, fetchRecipe } = useRecipesStore();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTIES[0]);
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [ingredients, setIngredients] = useState<IngredientInput[]>([{ name: '', amount: '', unit: UNITS[0] }]);
  const [steps, setSteps] = useState<StepInput[]>([{ description: '', imageUrl: '' }]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [nutrition, setNutrition] = useState<Nutrition | null>(null);
  const [loadingData, setLoadingData] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      loadRecipe();
    }
  }, [id]);

  useEffect(() => {
    const hasValidIngredient = ingredients.some((ing) => ing.name.trim() && ing.amount);
    if (hasValidIngredient) {
      calculateNutrition();
    } else {
      setNutrition(null);
    }
  }, [ingredients]);

  const loadRecipe = async () => {
    try {
      const recipe = await fetchRecipe(Number(id));
      setTitle(recipe.title);
      setCategory(recipe.category);
      setDifficulty(recipe.difficulty);
      setCookTime(String(recipe.cookTime));
      setServings(String(recipe.servings));
      setCoverImage(recipe.coverImage);
      setIngredients(
        recipe.ingredients.map((ing: Ingredient) => ({
          name: ing.name,
          amount: String(ing.amount),
          unit: ing.unit,
        }))
      );
      setSteps(
        recipe.steps.map((s: RecipeStep) => ({
          description: s.description,
          imageUrl: s.imageUrl,
        }))
      );
      setSelectedTags(recipe.tags);
      setNutrition(recipe.nutritionTotal);
    } catch {
    } finally {
      setLoadingData(false);
    }
  };

  const calculateNutrition = async () => {
    const validIngredients = ingredients.filter((ing) => ing.name.trim() && ing.amount);
    if (validIngredients.length === 0) return;
    setCalculating(true);
    try {
      const data: any = await api.nutrition.calculateRecipe({
        ingredients: validIngredients.map((ing) => ({
          name: ing.name,
          amount: Number(ing.amount),
          unit: ing.unit,
        })),
        servings: Number(servings) || 1,
      });
      setNutrition(data.total || data);
    } catch {
      setNutrition(null);
    } finally {
      setCalculating(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', unit: UNITS[0] }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof IngredientInput, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addStep = () => {
    setSteps([...steps, { description: '', imageUrl: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof StepInput, value: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !cookTime || !servings) return;
    setSubmitting(true);
    const payload = {
      title: title.trim(),
      category,
      difficulty,
      cookTime: Number(cookTime),
      servings: Number(servings),
      coverImage,
      ingredients: ingredients
        .filter((ing) => ing.name.trim() && ing.amount)
        .map((ing) => ({ name: ing.name.trim(), amount: Number(ing.amount), unit: ing.unit })),
      steps: steps
        .filter((s) => s.description.trim())
        .map((s, i) => ({ order: i + 1, description: s.description.trim(), imageUrl: s.imageUrl })),
      tags: selectedTags,
    };
    try {
      if (isEditing && id) {
        await updateRecipe(Number(id), payload);
      } else {
        await createRecipe(payload);
      }
      navigate(-1);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{isEditing ? '编辑菜谱' : '创建菜谱'}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">菜谱标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
            placeholder="输入菜谱标题"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">难度</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm bg-white"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">烹饪时间（分钟）</label>
            <input
              type="number"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
              placeholder="30"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">份量（人份）</label>
            <input
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
              placeholder="2"
              min="1"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">封面图片 URL</label>
          <input
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
            placeholder="https://example.com/image.jpg"
          />
          {coverImage && (
            <img src={coverImage} alt="封面预览" className="mt-3 rounded-xl max-h-40 object-cover" />
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">食材</h2>
        <div className="space-y-3">
          {ingredients.map((ing, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                placeholder="食材名称"
              />
              <input
                type="number"
                value={ing.amount}
                onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                className="w-24 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                placeholder="用量"
                min="0"
              />
              <select
                value={ing.unit}
                onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                className="w-20 px-2 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm bg-white"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <button
                onClick={() => removeIngredient(index)}
                disabled={ingredients.length <= 1}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addIngredient}
          className="flex items-center gap-2 mt-4 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加食材
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">制作步骤</h2>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold mt-2">
                {index + 1}
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  value={step.description}
                  onChange={(e) => updateStep(index, 'description', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm resize-none"
                  placeholder="描述这一步的操作..."
                />
                <input
                  type="text"
                  value={step.imageUrl}
                  onChange={(e) => updateStep(index, 'imageUrl', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                  placeholder="步骤图片 URL（可选）"
                />
              </div>
              <button
                onClick={() => removeStep(index)}
                disabled={steps.length <= 1}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed self-start mt-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addStep}
          className="flex items-center gap-2 mt-4 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加步骤
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">标签</h2>
        <div className="flex flex-wrap gap-3">
          {TAG_OPTIONS.map((tag) => (
            <label
              key={tag}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all border ${
                selectedTags.includes(tag)
                  ? 'bg-orange-50 text-orange-600 border-orange-300'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-200'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag)}
                className="sr-only"
              />
              {tag}
            </label>
          ))}
        </div>
      </div>

      {nutrition && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            营养预估
            {calculating && <Loader2 className="inline w-4 h-4 ml-2 animate-spin text-orange-500" />}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">热量</p>
              <p className="text-xl font-bold text-red-500">{nutrition.calories}<span className="text-xs font-normal ml-0.5">kcal</span></p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">蛋白质</p>
              <p className="text-xl font-bold text-blue-500">{nutrition.protein}<span className="text-xs font-normal ml-0.5">g</span></p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">碳水</p>
              <p className="text-xl font-bold text-amber-500">{nutrition.carbs}<span className="text-xs font-normal ml-0.5">g</span></p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">脂肪</p>
              <p className="text-xl font-bold text-green-500">{nutrition.fat}<span className="text-xs font-normal ml-0.5">g</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !cookTime || !servings}
          className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '提交中...' : isEditing ? '保存修改' : '创建菜谱'}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
