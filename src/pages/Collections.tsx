import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  X,
  Eye,
  Lock,
  ChefHat,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { Collection } from '@shared/types';

export default function Collections() {
  const { isAuthenticated } = useAuthStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    coverImage: '',
    isPublic: true,
  });

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const data = await api.collections.list();
      setCollections(data);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.collections.create(newCollection);
      setShowCreateModal(false);
      setNewCollection({ name: '', description: '', coverImage: '', isPublic: true });
      loadCollections();
    } catch (err: any) {
      alert(err.message || '创建失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">菜谱合集</h1>
          <p className="text-gray-500 mt-1">发现和创建精选菜谱合集</p>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建合集
          </button>
        )}
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-20">
          <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400">暂无合集</p>
          {isAuthenticated && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-orange-500 hover:text-orange-600 text-sm font-medium"
            >
              创建第一个合集
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              to={`/collections/${collection.id}`}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all no-underline"
            >
              <div className="relative h-40 bg-gradient-to-br from-orange-100 to-amber-100">
                {collection.coverImage ? (
                  <img
                    src={collection.coverImage}
                    alt={collection.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat className="w-12 h-12 text-orange-300" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  {collection.isPublic ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-white/80 backdrop-blur-sm rounded-full text-xs text-gray-600">
                      <Eye className="w-3 h-3" />
                      公开
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 bg-gray-800/60 backdrop-blur-sm rounded-full text-xs text-white">
                      <Lock className="w-3 h-3" />
                      私密
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 group-hover:text-orange-600 transition-colors">
                  {collection.name}
                </h3>
                {collection.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {collection.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <img
                      src={collection.creator.avatar}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="text-xs text-gray-500">
                      {collection.creator.username}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {collection.recipeCount} 道菜谱
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">创建合集</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  合集名称
                </label>
                <input
                  type="text"
                  value={newCollection.name}
                  onChange={(e) =>
                    setNewCollection({ ...newCollection, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="如：一周减脂餐"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={newCollection.description}
                  onChange={(e) =>
                    setNewCollection({ ...newCollection, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
                  placeholder="介绍一下这个合集..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  封面图片 URL
                </label>
                <input
                  type="url"
                  value={newCollection.coverImage}
                  onChange={(e) =>
                    setNewCollection({ ...newCollection, coverImage: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={newCollection.isPublic}
                  onChange={(e) =>
                    setNewCollection({ ...newCollection, isPublic: e.target.checked })
                  }
                  className="w-4 h-4 text-orange-500 rounded focus:ring-orange-400"
                />
                <label htmlFor="isPublic" className="text-sm text-gray-700">
                  公开可见
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                创建合集
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
