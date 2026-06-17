import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  Share2,
  Clock,
  Users,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Star,
  Send,
  UserPlus,
  UserCheck,
  ChevronRight,
  ChevronDown,
  History,
  GitFork,
  ChefHat,
  X,
  Play,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { Recipe, Review, RecipeVersion, ForkSource } from '@shared/types';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<RecipeVersion | null>(null);
  const [forkSource, setForkSource] = useState<ForkSource | null>(null);
  const [forking, setForking] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadRecipe();
    loadReviews();
    loadVersions();
    loadForkSource();
  }, [id]);

  const loadRecipe = async () => {
    try {
      const data = await api.recipes.get(Number(id));
      setRecipe(data);
      setIsFavorite(data.isFavorite);
      setIsFollowing(data.author.isFollowing);
    } catch {
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const data = await api.users.getReviews(Number(id));
      setReviews(data);
    } catch {
      setReviews([]);
    }
  };

  const loadVersions = async () => {
    try {
      const data = await api.versions.list(Number(id));
      setVersions(data);
    } catch {
      setVersions([]);
    }
  };

  const loadForkSource = async () => {
    try {
      const data = await api.versions.forkSource(Number(id));
      setForkSource(data);
    } catch {
      setForkSource(null);
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated) return;
    try {
      await api.users.favorite(Number(id));
      setIsFavorite((prev) => !prev);
    } catch {}
  };

  const toggleFollow = async () => {
    if (!isAuthenticated || !recipe) return;
    try {
      await api.users.follow(recipe.author.id);
      setIsFollowing((prev) => !prev);
    } catch {}
  };

  const handleFork = async () => {
    if (!isAuthenticated || !recipe) return;
    setForking(true);
    try {
      const newRecipe = await api.versions.fork(Number(id));
      navigate(`/recipes/${newRecipe.id}`);
    } catch (err: any) {
      alert(err.message || '分叉失败');
    } finally {
      setForking(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const handleSubmitReview = async () => {
    if (!isAuthenticated || newRating === 0 || !newComment.trim()) return;
    setSubmitting(true);
    try {
      await api.users.createReview({
        recipeId: Number(id),
        rating: newRating,
        comment: newComment.trim(),
      });
      setNewRating(0);
      setNewComment('');
      await loadReviews();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartCooking = () => {
    navigate(`/cooking/${id}`);
  };

  const viewVersion = async (versionNumber: number) => {
    try {
      const data = await api.versions.get(Number(id), versionNumber);
      setSelectedVersion(data);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-32 text-gray-400">
        <p className="text-lg">菜谱未找到</p>
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : recipe.rating;

  const nutritionItems = [
    { label: '热量', total: recipe.nutritionTotal.calories, perServing: recipe.nutritionPerServing.calories, unit: 'kcal', icon: Flame, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '蛋白质', total: recipe.nutritionTotal.protein, perServing: recipe.nutritionPerServing.protein, unit: 'g', icon: Beef, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: '碳水', total: recipe.nutritionTotal.carbs, perServing: recipe.nutritionPerServing.carbs, unit: 'g', icon: Wheat, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: '脂肪', total: recipe.nutritionTotal.fat, perServing: recipe.nutritionPerServing.fat, unit: 'g', icon: Droplets, color: 'text-green-500', bg: 'bg-green-50' },
  ];

  const renderStars = (rating: number, size = 'w-4 h-4') => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`${size} ${i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
      />
    ));
  };

  const displayIngredients = selectedVersion ? selectedVersion.ingredientsSnapshot : recipe.ingredients;
  const displaySteps = selectedVersion ? selectedVersion.stepsSnapshot : recipe.steps;

  return (
    <div className="space-y-8">
      <div className="relative rounded-2xl overflow-hidden h-72 sm:h-96">
        <img src={recipe.coverImage} alt={recipe.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
          <h1 className="text-2xl sm:text-4xl font-bold mb-3">{recipe.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">{recipe.category}</span>
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">{recipe.difficulty}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{recipe.cookTime}分钟</span>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" />{recipe.servings}人份</span>
          </div>
        </div>
      </div>

      {forkSource && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <GitFork className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-sm text-amber-700">
            改编自
            <Link to={`/recipes/${forkSource.id}`} className="font-medium text-amber-800 hover:underline ml-1">
              {forkSource.author.username} 的 {forkSource.title}
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Link
          to={`/profile/${recipe.author.id}`}
          className="flex items-center gap-3 no-underline"
        >
          <img src={recipe.author.avatar} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-orange-100" />
          <div>
            <p className="font-semibold text-gray-800 hover:text-orange-600 transition-colors">{recipe.author.username}</p>
            <p className="text-xs text-gray-400">{recipe.author.recipeCount} 个菜谱 · {recipe.author.followerCount} 粉丝</p>
          </div>
        </Link>
        {isAuthenticated && user?.id !== recipe.author.id && (
          <button
            onClick={toggleFollow}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              isFollowing
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {isFollowing ? '已关注' : '关注'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={toggleFavorite}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isFavorite
              ? 'bg-red-50 text-red-500 border border-red-200'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-red-200 hover:text-red-500'
          }`}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500' : ''}`} />
          {isFavorite ? '已收藏' : '收藏'}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:border-orange-200 hover:text-orange-600 transition-all"
        >
          <Share2 className="w-5 h-5" />
          分享
        </button>
        {isAuthenticated && user?.id !== recipe.author.id && (
          <button
            onClick={handleFork}
            disabled={forking}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            <GitFork className="w-5 h-5" />
            {forking ? '分叉中...' : '分叉改编'}
          </button>
        )}
        <button
          onClick={handleStartCooking}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-all"
        >
          <Play className="w-5 h-5" />
          开始烹饪
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">营养信息</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {nutritionItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`${item.bg} rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-sm font-medium text-gray-600">{item.label}</span>
                </div>
                <p className={`text-2xl font-bold ${item.color}`}>{item.total}<span className="text-xs font-normal ml-1">{item.unit}</span></p>
                <p className="text-xs text-gray-400 mt-1">每份 {item.perServing}{item.unit}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">食材清单</h2>
        {selectedVersion && (
          <div className="mb-3 px-3 py-2 bg-amber-50 rounded-lg text-sm text-amber-700">
            正在查看版本 {selectedVersion.versionNumber} 的食材
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500">
                <th className="px-5 py-3 font-medium">食材</th>
                <th className="px-5 py-3 font-medium text-right">用量</th>
              </tr>
            </thead>
            <tbody>
              {displayIngredients.map((ing, i) => (
                <tr key={i} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-5 py-3 text-gray-700">{ing.name}</td>
                  <td className="px-5 py-3 text-gray-700 text-right">{ing.amount} {ing.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">制作步骤</h2>
        {selectedVersion && (
          <div className="mb-3 px-3 py-2 bg-amber-50 rounded-lg text-sm text-amber-700">
            正在查看版本 {selectedVersion.versionNumber} 的步骤
          </div>
        )}
        <div className="space-y-4">
          {displaySteps.map((step) => (
            <div key={step.order} className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                {step.order}
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-gray-700 leading-relaxed">{step.description}</p>
                {step.imageUrl && (
                  <img src={step.imageUrl} alt={`步骤${step.order}`} className="rounded-xl max-h-48 object-cover" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {recipe.tags.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">标签</h2>
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span key={tag} className="px-4 py-1.5 bg-orange-50 text-orange-600 rounded-full text-sm font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setShowVersions(!showVersions)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-800">版本历史</h2>
            <span className="text-sm text-gray-400">{versions.length} 个版本</span>
          </div>
          {showVersions ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showVersions && (
          <div className="border-t border-gray-100 p-5">
            {versions.length === 0 ? (
              <p className="text-center text-gray-400 py-4">暂无版本记录</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div key={version.id} className="relative pl-10">
                      <div className={`absolute left-2 top-2 w-5 h-5 rounded-full border-2 ${
                        selectedVersion?.versionNumber === version.versionNumber
                          ? 'bg-orange-500 border-orange-500'
                          : 'bg-white border-gray-300'
                      }`} />
                      <div
                        className={`p-4 rounded-xl cursor-pointer transition-all ${
                          selectedVersion?.versionNumber === version.versionNumber
                            ? 'bg-orange-50 border border-orange-200'
                            : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                        }`}
                        onClick={() => {
                          if (selectedVersion?.versionNumber === version.versionNumber) {
                            setSelectedVersion(null);
                          } else {
                            viewVersion(version.versionNumber);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-800">版本 {version.versionNumber}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{version.changeDescription}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedVersion && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedVersion(null)}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  返回当前版本
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">评价</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold text-gray-800">{avgRating.toFixed(1)}</span>
            <div>
              <div className="flex items-center gap-0.5">{renderStars(avgRating, 'w-5 h-5')}</div>
              <p className="text-sm text-gray-400 mt-1">{reviews.length} 条评价</p>
            </div>
          </div>
        </div>

        {isAuthenticated && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">写下你的评价</h3>
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: 5 }, (_, i) => (
                <button
                  key={i}
                  onMouseEnter={() => setHoverRating(i + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setNewRating(i + 1)}
                  className="p-0.5"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      i < (hoverRating || newRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-200 hover:text-yellow-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm text-gray-400 ml-2">
                {newRating > 0 ? `${newRating} 星` : '选择评分'}
              </span>
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none text-sm"
              placeholder="分享你的烹饪体验..."
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleSubmitReview}
                disabled={newRating === 0 || !newComment.trim() || submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {submitting ? '提交中...' : '提交评价'}
              </button>
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <div className="bg-orange-50 rounded-2xl p-4 mb-6 text-center text-sm text-orange-600">
            请先登录后再评价
          </div>
        )}

        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-2">
                <Link to={`/profile/${review.user.id}`} className="no-underline">
                  <img src={review.user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                </Link>
                <div className="flex-1">
                  <Link to={`/profile/${review.user.id}`} className="text-sm font-medium text-gray-800 hover:text-orange-600 no-underline transition-colors">
                    {review.user.username}
                  </Link>
                  <div className="flex items-center gap-0.5 mt-0.5">{renderStars(review.rating)}</div>
                </div>
                <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-center text-gray-400 py-8">暂无评价，快来写下第一条吧</p>
          )}
        </div>
      </div>
    </div>
  );
}
