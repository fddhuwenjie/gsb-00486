import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Search, Star, Eye, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Recipe } from '@shared/types';
import { useRecipesStore } from '@/stores/recipesStore';

const categoryOptions = ['全部', '中餐', '西餐', '日料', '烘焙', '饮品', '汤羹'];
const difficultyOptions = ['入门', '中等', '困难'];
const sortOptions = [
  { value: 'latest', label: '最新' },
  { value: 'rating', label: '最高评分' },
  { value: 'views', label: '最多浏览' },
  { value: 'time', label: '最省时' },
];

const difficultyConfig: Record<string, string> = {
  '入门': 'bg-green-100 text-green-700',
  '中等': 'bg-yellow-100 text-yellow-700',
  '困难': 'bg-red-100 text-red-700',
};

export default function Recipes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { recipes, total, page, loading, filters, fetchRecipes, setFilters } = useRecipesStore();

  const categoryFromUrl = searchParams.get('category') || '';
  const searchFromUrl = searchParams.get('search') || '';
  const activeCategory = filters.category || categoryFromUrl || '全部';
  const activeDifficulty = filters.difficulty || '';
  const activeSort = filters.sort || 'latest';
  const activeSearch = filters.search || searchFromUrl || '';
  const activeTag = filters.tag || '';
  const totalPages = Math.ceil(total / 12);

  useEffect(() => {
    const initialFilters: Record<string, string> = {};
    const cat = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    if (cat) initialFilters.category = cat;
    if (search) initialFilters.search = search;
    if (Object.keys(initialFilters).length > 0) {
      setFilters(initialFilters);
    }
  }, [searchParams, setFilters]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (activeCategory !== '全部') params.category = activeCategory;
    if (activeDifficulty) params.difficulty = activeDifficulty;
    if (activeSort && activeSort !== 'latest') params.sort = activeSort;
    if (activeSearch) params.search = activeSearch;
    if (activeTag) params.tag = activeTag;
    fetchRecipes(params, 1);
  }, [activeCategory, activeDifficulty, activeSort, activeSearch, activeTag, fetchRecipes]);

  const handleCategoryChange = (cat: string) => {
    setFilters({ category: cat === '全部' ? '' : cat });
    const params = new URLSearchParams(searchParams);
    if (cat === '全部') {
      params.delete('category');
    } else {
      params.set('category', cat);
    }
    setSearchParams(params, { replace: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const q = formData.get('search') as string;
    setFilters({ search: q });
  };

  const handleDifficultyToggle = (diff: string) => {
    setFilters({ difficulty: activeDifficulty === diff ? '' : diff });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ sort: e.target.value });
  };

  const handleTagRemove = () => {
    setFilters({ tag: '' });
  };

  const handlePageChange = (newPage: number) => {
    const params: Record<string, string> = {};
    if (activeCategory !== '全部') params.category = activeCategory;
    if (activeDifficulty) params.difficulty = activeDifficulty;
    if (activeSort && activeSort !== 'latest') params.sort = activeSort;
    if (activeSearch) params.search = activeSearch;
    if (activeTag) params.tag = activeTag;
    fetchRecipes(params, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          name="search"
          type="text"
          defaultValue={activeSearch}
          placeholder="搜索菜谱名称、食材..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
        />
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500 font-medium">难度:</span>
        {difficultyOptions.map((diff) => (
          <button
            key={diff}
            onClick={() => handleDifficultyToggle(diff)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeDifficulty === diff
                ? difficultyConfig[diff]
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {diff}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">排序:</span>
          <select
            value={activeSort}
            onChange={handleSortChange}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTag && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">标签:</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium">
            {activeTag}
            <button onClick={handleTagRemove} className="hover:text-orange-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
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
      ) : recipes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">没有找到符合条件的菜谱</p>
          <p className="text-sm mt-2">尝试调整筛选条件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recipes.map((recipe: Recipe) => (
            <Link
              key={recipe.id}
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
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-orange-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => handlePageChange(p)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-orange-300'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-orange-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
