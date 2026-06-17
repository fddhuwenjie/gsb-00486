import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChefHat,
  Trash2,
  Plus,
  X,
  Search,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { Collection, Recipe } from '@shared/types';

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadCollection();
  }, [id]);

  const loadCollection = async () => {
    try {
      const data = await api.collections.get(Number(id));
      setCollection(data);
    } catch {
      setCollection(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRecipes = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await api.recipes.list({ search: searchQuery, limit: '10' });
      setSearchResults(data.recipes);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddRecipe = async (recipeId: number) => {
    try {
      await api.collections.addRecipe(Number(id), recipeId);
      loadCollection();
      setShowAddRecipe(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      alert(err.message || '添加失败');
    }
  };

  const handleRemoveRecipe = async (recipeId: number) => {
    if (!confirm('确定要从合集中移除这道菜谱吗？')) return;
    try {
      await api.collections.removeRecipe(Number(id), recipeId);
      loadCollection();
    } catch {}
  };

  const isOwner = user && collection && user.id === collection.creator.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="text-center py-32 text-gray-400">
        <p className="text-lg">合集不存在</p>
        <Link to="/collections" className="text-orange-500 hover:text-orange-600 text-sm mt-2 inline-block">
          返回合集列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        返回
      </button>

      <div className="relative rounded-2xl overflow-hidden h-48 sm:h-64">
        {collection.coverImage ? (
          <img
            src={collection.coverImage}
            alt={collection.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-200 to-amber-200 flex items-center justify-center">
            <ChefHat className="w-16 h-16 text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold">{collection.name}</h1>
          {collection.description && (
            <p className="text-white/80 mt-2">{collection.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <Link
              to={`/profile/${collection.creator.id}`}
              className="flex items-center gap-2 no-underline"
            >
              <img
                src={collection.creator.avatar}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-white/30"
              />
              <span className="text-sm text-white/90">{collection.creator.username}</span>
            </Link>
            <span className="text-sm text-white/70">
              {collection.recipeCount} 道菜谱
            </span>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddRecipe(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加菜谱
          </button>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">合集菜谱</h2>
        {!collection.recipes || collection.recipes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <ChefHat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">合集中还没有菜谱</p>
            {isOwner && (
              <button
                onClick={() => setShowAddRecipe(true)}
                className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium"
              >
                添加第一道菜谱
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collection.recipes.map((recipe, index) => (
              <div
                key={recipe.id}
                className="relative bg-white rounded-xl border border-gray-100 overflow-hidden group"
              >
                <Link to={`/recipes/${recipe.id}`} className="block no-underline">
                  <div className="relative h-36">
                    <img
                      src={recipe.coverImage}
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-800 text-sm truncate">
                      {recipe.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {recipe.difficulty} · {recipe.cookTime}分钟
                    </p>
                  </div>
                </Link>
                {isOwner && (
                  <button
                    onClick={() => handleRemoveRecipe(recipe.id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddRecipe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAddRecipe(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">添加菜谱到合集</h2>
              <button
                onClick={() => setShowAddRecipe(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchRecipes()}
                  placeholder="搜索菜谱..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearchRecipes}
                className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                搜索
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">
                  {searchQuery ? '没有找到相关菜谱' : '输入关键词搜索菜谱'}
                </p>
              ) : (
                searchResults.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleAddRecipe(recipe.id)}
                  >
                    <img
                      src={recipe.coverImage}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {recipe.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {recipe.difficulty} · {recipe.cookTime}分钟
                      </p>
                    </div>
                    <Plus className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
