import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Eye, Clock, ArrowRight, Calendar, Lightbulb } from 'lucide-react';
import type { Recipe } from '@shared/types';

const categories = [
  { name: '中餐', emoji: '🥢', color: 'bg-red-50 text-red-700 border-red-200' },
  { name: '西餐', emoji: '🍝', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: '日料', emoji: '🍣', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { name: '烘焙', emoji: '🧁', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: '饮品', emoji: '🧋', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { name: '汤羹', emoji: '🍲', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
];

const difficultyConfig: Record<string, string> = {
  '入门': 'bg-green-100 text-green-700',
  '中等': 'bg-yellow-100 text-yellow-700',
  '困难': 'bg-red-100 text-red-700',
};

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 hover:border-orange-200"
    >
      <div className="relative overflow-hidden">
        <img
          src={recipe.coverImage}
          alt={recipe.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <span className="absolute top-3 left-3 px-2.5 py-1 text-xs font-medium bg-white/90 backdrop-blur-sm rounded-full text-gray-700">
          {recipe.category}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 group-hover:text-orange-600 transition-colors line-clamp-1">
          {recipe.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${difficultyConfig[recipe.difficulty] || 'bg-gray-100 text-gray-600'}`}>
            {recipe.difficulty}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            {recipe.cookTime}分钟
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
            {recipe.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {recipe.viewCount}
          </span>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
          <img
            src={recipe.author.avatar}
            alt={recipe.author.username}
            className="w-6 h-6 rounded-full object-cover"
          />
          <span className="text-xs text-gray-500">{recipe.author.username}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [popularRecipes, setPopularRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const userId = localStorage.getItem('userId');
        if (userId) headers['x-user-id'] = userId;
        const res = await fetch('/api/recommendations/popular?limit=8', { headers });
        const data = await res.json();
        if (data.success) {
          setPopularRecipes(data.data);
        }
      } catch {
        setPopularRecipes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPopular();
  }, []);

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 px-8 py-16 md:py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
        <h1 className="relative text-4xl md:text-6xl font-bold text-white mb-4">味知食谱</h1>
        <p className="relative text-lg md:text-xl text-orange-100 mb-8">发现美味，分享生活</p>
        <Link
          to="/recipes"
          className="relative inline-flex items-center gap-2 px-8 py-3 bg-white text-orange-600 font-semibold rounded-full hover:bg-orange-50 transition-colors shadow-lg"
        >
          探索菜谱
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">分类浏览</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={`/recipes?category=${cat.name}`}
              className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all hover:scale-105 hover:shadow-md ${cat.color}`}
            >
              <span className="text-3xl">{cat.emoji}</span>
              <span className="text-sm font-medium">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">热门菜谱</h2>
          <Link to="/recipes" className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
            查看更多 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">快捷入口</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/meal-plan"
            className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 hover:shadow-md transition-all group"
          >
            <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">每周膳食计划</h3>
              <p className="text-sm text-gray-500">规划你的一周美食</p>
            </div>
            <ArrowRight className="w-5 h-5 text-green-400 ml-auto" />
          </Link>
          <Link
            to="/recommend"
            className="flex items-center gap-4 p-6 bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl border border-purple-100 hover:shadow-md transition-all group"
          >
            <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
              <Lightbulb className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">智能推荐</h3>
              <p className="text-sm text-gray-500">发现适合你的菜谱</p>
            </div>
            <ArrowRight className="w-5 h-5 text-purple-400 ml-auto" />
          </Link>
        </div>
      </section>
    </div>
  );
}
