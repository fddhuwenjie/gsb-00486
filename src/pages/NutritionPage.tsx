import { useEffect, useState } from 'react';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useAuthStore } from '@/stores/authStore';
import type { IngredientNutrition } from '@shared/types';
import { AlertTriangle, Flame, Beef, Wheat, Droplets, UtensilsCrossed } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const RECOMMENDED = { calories: 2000, protein: 60, carbs: 300, fat: 65 };

function getColor(actual: number, recommended: number): string {
  const ratio = actual / recommended;
  if (ratio >= 0.7 && ratio <= 1.3) return 'bg-green-500';
  if ((ratio >= 0.5 && ratio < 0.7) || (ratio > 1.3 && ratio <= 1.5)) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getTextColor(actual: number, recommended: number): string {
  const ratio = actual / recommended;
  if (ratio >= 0.7 && ratio <= 1.3) return 'text-green-600';
  if ((ratio >= 0.5 && ratio < 0.7) || (ratio > 1.3 && ratio <= 1.5)) return 'text-yellow-600';
  return 'text-red-600';
}

const BAR_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];
const RECOMMENDED_COLOR = '#94a3b8';

export default function NutritionPage() {
  const { isAuthenticated } = useAuthStore();
  const { nutrition, fetchNutrition, planId } = useMealPlanStore();
  const [ingredients, setIngredients] = useState<IngredientNutrition[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && planId) {
      fetchNutrition();
    }
  }, [isAuthenticated, planId, fetchNutrition]);

  useEffect(() => {
    setIngredientsLoading(true);
    fetch('/api/nutrition/ingredients')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setIngredients(data.data);
      })
      .finally(() => setIngredientsLoading(false));
  }, []);

  const chartData = nutrition
    ? [
        { name: '热量', 实际摄入: nutrition.dailyAverage.calories, 推荐值: nutrition.recommended.calories, fill: BAR_COLORS[0] },
        { name: '蛋白质', 实际摄入: nutrition.dailyAverage.protein, 推荐值: nutrition.recommended.protein, fill: BAR_COLORS[1] },
        { name: '碳水', 实际摄入: nutrition.dailyAverage.carbs, 推荐值: nutrition.recommended.carbs, fill: BAR_COLORS[2] },
        { name: '脂肪', 实际摄入: nutrition.dailyAverage.fat, 推荐值: nutrition.recommended.fat, fill: BAR_COLORS[3] },
      ]
    : [];

  const nutrientCards = nutrition
    ? [
        { label: '热量', value: nutrition.dailyAverage.calories, unit: 'kcal', recommended: RECOMMENDED.calories, icon: Flame, color: 'text-red-500', bg: 'bg-red-50' },
        { label: '蛋白质', value: nutrition.dailyAverage.protein, unit: 'g', recommended: RECOMMENDED.protein, icon: Beef, color: 'text-blue-500', bg: 'bg-blue-50' },
        { label: '碳水', value: nutrition.dailyAverage.carbs, unit: 'g', recommended: RECOMMENDED.carbs, icon: Wheat, color: 'text-amber-500', bg: 'bg-amber-50' },
        { label: '脂肪', value: nutrition.dailyAverage.fat, unit: 'g', recommended: RECOMMENDED.fat, icon: Droplets, color: 'text-green-500', bg: 'bg-green-50' },
      ]
    : [];

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <UtensilsCrossed className="w-16 h-16 mb-4" />
        <p className="text-lg">请先登录以查看营养分析</p>
      </div>
    );
  }

  if (!planId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <UtensilsCrossed className="w-16 h-16 mb-4" />
        <p className="text-lg">暂无膳食计划</p>
        <p className="text-sm mt-2">请先创建膳食计划以查看营养分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">营养分析</h1>

      {nutrition && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">日均摄入 vs 推荐值</h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="实际摄入" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="推荐值" fill={RECOMMENDED_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {nutrientCards.map(({ label, value, unit, recommended, icon: Icon, color, bg }) => {
              const percent = Math.min((value / recommended) * 100, 150);
              return (
                <div key={label} className={`${bg} rounded-2xl p-5 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">{label}</span>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <span className={`text-2xl font-bold ${getTextColor(value, recommended)}`}>
                      {Math.round(value)}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">{unit}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${getColor(value, recommended)} transition-all`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    推荐值: {recommended}{unit}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">周营养汇总</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-sm font-medium text-gray-500">营养素</th>
                    <th className="pb-3 text-sm font-medium text-gray-500 text-right">周总量</th>
                    <th className="pb-3 text-sm font-medium text-gray-500 text-right">日均</th>
                    <th className="pb-3 text-sm font-medium text-gray-500 text-right">推荐值</th>
                    <th className="pb-3 text-sm font-medium text-gray-500 text-right">达标率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {([
                    ['热量', nutrition.weeklyTotal.calories, nutrition.dailyAverage.calories, nutrition.recommended.calories, 'kcal'],
                    ['蛋白质', nutrition.weeklyTotal.protein, nutrition.dailyAverage.protein, nutrition.recommended.protein, 'g'],
                    ['碳水', nutrition.weeklyTotal.carbs, nutrition.dailyAverage.carbs, nutrition.recommended.carbs, 'g'],
                    ['脂肪', nutrition.weeklyTotal.fat, nutrition.dailyAverage.fat, nutrition.recommended.fat, 'g'],
                  ] as const).map(([name, total, avg, rec, unit]) => {
                    const pct = Math.round((avg / rec) * 100);
                    return (
                      <tr key={name}>
                        <td className="py-3 text-sm font-medium text-gray-700">{name}</td>
                        <td className="py-3 text-sm text-gray-600 text-right">{Math.round(total)} {unit}</td>
                        <td className="py-3 text-sm text-gray-600 text-right">{Math.round(avg)} {unit}</td>
                        <td className="py-3 text-sm text-gray-600 text-right">{Math.round(rec)} {unit}</td>
                        <td className={`py-3 text-sm font-medium text-right ${getTextColor(avg, rec)}`}>
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {nutrition.warnings && nutrition.warnings.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-gray-800">营养不均衡提醒</h2>
              {nutrition.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">{warning}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">食材营养数据库</h2>
        {ingredientsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-sm font-medium text-gray-500">食材</th>
                  <th className="pb-3 text-sm font-medium text-gray-500">分类</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-right">热量/100g</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-right">蛋白质(g)</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-right">碳水(g)</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-right">脂肪(g)</th>
                  <th className="pb-3 text-sm font-medium text-gray-500 text-right">单价/100g</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ingredients.map((ing) => (
                  <tr key={ing.id}>
                    <td className="py-3 text-sm font-medium text-gray-700">{ing.name}</td>
                    <td className="py-3 text-sm text-gray-500">{ing.category}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">{ing.calories}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">{ing.protein}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">{ing.carbs}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">{ing.fat}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">¥{ing.pricePer100g.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
