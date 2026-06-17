import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  Users,
  Gift,
  Target,
  Plus,
  X,
  Medal,
  Crown,
  Award,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import type { Challenge, ChallengeRankingItem } from '@shared/types';

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [ranking, setRanking] = useState<ChallengeRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    recipeTitle: '',
  });

  useEffect(() => {
    if (!id) return;
    loadChallenge();
    loadRanking();
  }, [id]);

  const loadChallenge = async () => {
    try {
      const data = await api.challenges.get(Number(id));
      setChallenge(data);
    } catch {
      setChallenge(null);
    }
  };

  const loadRanking = async () => {
    try {
      const data = await api.challenges.ranking(Number(id));
      setRanking(data);
    } catch {
      setRanking([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      await api.challenges.join(Number(id));
      loadChallenge();
      loadRanking();
    } catch (err: any) {
      alert(err.message || '参与失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.challenges.submit(Number(id), {
        recipeTitle: submitForm.recipeTitle,
      });
      setShowSubmitModal(false);
      setSubmitForm({ recipeTitle: '' });
      loadChallenge();
      loadRanking();
    } catch (err: any) {
      alert(err.message || '提交失败');
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-gray-500 text-sm font-medium">{rank}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="text-center py-32 text-gray-400">
        <p className="text-lg">挑战不存在</p>
        <Link to="/challenges" className="text-orange-500 hover:text-orange-600 text-sm mt-2 inline-block">
          返回挑战列表
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

      <div className="relative rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-8 text-white">
          <Trophy className="w-16 h-16 text-white/30 absolute top-6 right-6" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium mb-3">
              {new Date(challenge.startDate) > new Date() ? '即将开始' : new Date(challenge.endDate) < new Date() ? '已结束' : '进行中'}
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">{challenge.name}</h1>
            {challenge.description && (
              <p className="text-white/90 mb-6">{challenge.description}</p>
            )}
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(challenge.startDate).toLocaleDateString()} - {new Date(challenge.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{challenge.participantCount} 人参与</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAuthenticated && !challenge.isParticipating && (
        <button
          onClick={handleJoin}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
        >
          参与挑战
        </button>
      )}

      {challenge.isParticipating && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-green-800">你已参与挑战</p>
              <p className="text-sm text-green-600">
                已提交 {challenge.mySubmissions?.length || 0} 道作品
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            提交作品
          </button>
        </div>
      )}

      {challenge.rules && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">参与规则</h2>
          <p className="text-gray-600 whitespace-pre-wrap">{challenge.rules}</p>
        </div>
      )}

      {challenge.reward && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-amber-800">挑战奖励</h2>
          </div>
          <p className="text-amber-700">{challenge.reward}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">参与排行</h2>
        {ranking.length === 0 ? (
          <p className="text-center text-gray-400 py-8">暂无参与者</p>
        ) : (
          <div className="space-y-3">
            {ranking.map((item) => (
              <div
                key={item.userId}
                className={`flex items-center gap-4 p-3 rounded-xl ${
                  item.rank <= 3 ? 'bg-gradient-to-r from-orange-50 to-amber-50' : 'bg-gray-50'
                }`}
              >
                <div className="w-8 flex justify-center">
                  {getRankIcon(item.rank)}
                </div>
                <Link to={`/profile/${item.userId}`} className="flex items-center gap-3 flex-1 no-underline">
                  <img
                    src={item.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium text-gray-800">{item.username}</p>
                    {item.bio && (
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">
                        {item.bio}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="text-right">
                  <p className="font-bold text-gray-800">{item.submissionCount}</p>
                  <p className="text-xs text-gray-400">道作品</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">提交作品</h2>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作品名称
                </label>
                <input
                  type="text"
                  value={submitForm.recipeTitle}
                  onChange={(e) =>
                    setSubmitForm({ ...submitForm, recipeTitle: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="请输入你的作品名称"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                提交作品
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
