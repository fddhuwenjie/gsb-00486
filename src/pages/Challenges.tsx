import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Calendar,
  Users,
  Gift,
  Clock,
  Plus,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { Challenge } from '@shared/types';

export default function Challenges() {
  const { isAuthenticated } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    rules: '',
    reward: '',
  });

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const data = await api.challenges.list();
      setChallenges(data);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.challenges.create(newChallenge);
      setShowCreateModal(false);
      setNewChallenge({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        rules: '',
        reward: '',
      });
      loadChallenges();
    } catch (err: any) {
      alert(err.message || '创建失败');
    }
  };

  const getChallengeStatus = (challenge: Challenge) => {
    const now = new Date();
    const start = new Date(challenge.startDate);
    const end = new Date(challenge.endDate);

    if (now < start) return 'upcoming';
    if (now > end) return 'ended';
    return 'ongoing';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            进行中
          </span>
        );
      case 'upcoming':
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            即将开始
          </span>
        );
      case 'ended':
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
            已结束
          </span>
        );
      default:
        return null;
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
          <h1 className="text-2xl font-bold text-gray-800">烹饪挑战</h1>
          <p className="text-gray-500 mt-1">参与挑战，展示你的厨艺</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          发起挑战
        </button>
      </div>

      {challenges.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400">暂无挑战活动</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-orange-500 hover:text-orange-600 text-sm font-medium"
          >
            发起第一个挑战
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {challenges.map((challenge) => {
            const status = getChallengeStatus(challenge);
            return (
              <Link
                key={challenge.id}
                to={`/challenges/${challenge.id}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all no-underline"
              >
                <div className="relative h-40 bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
                  <Trophy className="w-12 h-12 text-white/30 absolute top-4 right-4" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(status)}
                    </div>
                    <h3 className="text-xl font-bold group-hover:translate-x-1 transition-transform">
                      {challenge.name}
                    </h3>
                  </div>
                </div>
                <div className="p-5">
                  {challenge.description && (
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                      {challenge.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(challenge.startDate).toLocaleDateString()} - {new Date(challenge.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Users className="w-4 h-4" />
                      <span>{challenge.participantCount} 人参与</span>
                    </div>
                  </div>
                  {challenge.reward && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
                      <Gift className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-amber-700">奖励：{challenge.reward}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">发起挑战</h2>
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
                  挑战名称
                </label>
                <input
                  type="text"
                  value={newChallenge.name}
                  onChange={(e) =>
                    setNewChallenge({ ...newChallenge, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="如：本周鸡蛋主题挑战"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  挑战描述
                </label>
                <textarea
                  value={newChallenge.description}
                  onChange={(e) =>
                    setNewChallenge({ ...newChallenge, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
                  placeholder="描述一下这个挑战..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    开始时间
                  </label>
                  <input
                    type="date"
                    value={newChallenge.startDate}
                    onChange={(e) =>
                      setNewChallenge({ ...newChallenge, startDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    结束时间
                  </label>
                  <input
                    type="date"
                    value={newChallenge.endDate}
                    onChange={(e) =>
                      setNewChallenge({ ...newChallenge, endDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  参与规则
                </label>
                <textarea
                  value={newChallenge.rules}
                  onChange={(e) =>
                    setNewChallenge({ ...newChallenge, rules: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
                  placeholder="参与规则和要求..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  奖励描述
                </label>
                <input
                  type="text"
                  value={newChallenge.reward}
                  onChange={(e) =>
                    setNewChallenge({ ...newChallenge, reward: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="如：最佳创意奖"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                发起挑战
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
