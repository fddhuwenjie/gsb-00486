import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { UserProfile, Recipe } from '@shared/types';
import { UserPlus, UserMinus, Heart, Star, Eye, Users, BookOpen } from 'lucide-react';

type TabKey = 'recipes' | 'favorites' | 'following' | 'followers';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'recipes', label: '发布的菜谱' },
  { key: 'favorites', label: '收藏' },
  { key: 'following', label: '关注' },
  { key: 'followers', label: '粉丝' },
];

function RecipeCard({ recipe, onFavorite }: { recipe: Recipe; onFavorite: (id: number) => void }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="group block no-underline">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-orange-50">
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={recipe.coverImage}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
              {recipe.category}
            </span>
          </div>
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

function UserCard({ user }: { user: UserProfile }) {
  return (
    <Link
      to={`/profile/${user.id}`}
      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-orange-50 hover:shadow-md transition-all no-underline"
    >
      <img
        src={user.avatar}
        alt={user.username}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{user.username}</p>
        {user.bio && <p className="text-sm text-gray-500 truncate">{user.bio}</p>}
      </div>
    </Link>
  );
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const userId = Number(id);
  const isOwnProfile = currentUser?.id === userId;

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.users.profile(userId);
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchTabData = useCallback(async (tab: TabKey) => {
    setTabLoading(true);
    try {
      switch (tab) {
        case 'recipes': {
          const data = await api.users.recipes(userId);
          setRecipes(data as Recipe[]);
          break;
        }
        case 'favorites': {
          const data = await api.users.favorites(userId);
          setFavorites(data as Recipe[]);
          break;
        }
        case 'following': {
          const res = await fetch(`/api/users/profile/${userId}/following`, {
            headers: { 'x-user-id': String(localStorage.getItem('userId') || '') },
          });
          const result = await res.json();
          if (result.success) setFollowing(result.data as UserProfile[]);
          break;
        }
        case 'followers': {
          const res = await fetch(`/api/users/profile/${userId}/followers`, {
            headers: { 'x-user-id': String(localStorage.getItem('userId') || '') },
          });
          const result = await res.json();
          if (result.success) setFollowers(result.data as UserProfile[]);
          break;
        }
      }
    } catch {
    } finally {
      setTabLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  const handleFollowToggle = async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      await api.users.follow(userId);
      setProfile((prev) => prev ? {
        ...prev,
        isFollowing: !prev.isFollowing,
        followerCount: prev.isFollowing ? prev.followerCount - 1 : prev.followerCount + 1,
      } : null);
    } catch {
    } finally {
      setFollowLoading(false);
    }
  };

  const handleFavoriteToggle = async (recipeId: number) => {
    try {
      await api.users.favorite(recipeId);
      const updater = (list: Recipe[]) =>
        list.map((r) => r.id === recipeId ? { ...r, isFavorite: !r.isFavorite } : r);
      setRecipes(updater);
      setFavorites(updater);
    } catch {
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>用户不存在</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-orange-50 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <img
            src={profile.avatar}
            alt={profile.username}
            className="w-24 h-24 rounded-full object-cover ring-4 ring-orange-100"
          />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-800">{profile.username}</h1>
            {profile.bio && <p className="text-gray-500 mt-1">{profile.bio}</p>}
            <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">{profile.recipeCount}</p>
                <p className="text-xs text-gray-500">菜谱</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">{profile.followerCount}</p>
                <p className="text-xs text-gray-500">粉丝</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">{profile.followingCount}</p>
                <p className="text-xs text-gray-500">关注</p>
              </div>
            </div>
          </div>
          {!isOwnProfile && (
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                profile.isFollowing
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {profile.isFollowing ? (
                <>
                  <UserMinus className="w-4 h-4" />
                  取消关注
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  关注
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-50">
        <div className="flex border-b border-orange-50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {tabLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {(activeTab === 'recipes' || activeTab === 'favorites') && (
                <>
                  {(activeTab === 'recipes' ? recipes : favorites).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(activeTab === 'recipes' ? recipes : favorites).map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} onFavorite={handleFavoriteToggle} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>{activeTab === 'recipes' ? '还没有发布菜谱' : '还没有收藏菜谱'}</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'following' && (
                <>
                  {following.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {following.map((u) => (
                        <UserCard key={u.id} user={u} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>还没有关注任何人</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'followers' && (
                <>
                  {followers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {followers.map((u) => (
                        <UserCard key={u.id} user={u} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p>还没有粉丝</p>
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
