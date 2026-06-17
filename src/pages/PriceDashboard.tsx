import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Plus,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { IngredientPrice } from '@shared/types';

export default function PriceDashboard() {
  const [prices, setPrices] = useState<IngredientPrice[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPrice, setNewPrice] = useState({
    ingredientName: '',
    price: '',
    unit: '100g',
    marketName: '',
  });

  useEffect(() => {
    loadPrices();
  }, []);

  useEffect(() => {
    if (prices.length > 0 && !selectedIngredient) {
      setSelectedIngredient(prices[0].ingredientName);
    }
  }, [prices]);

  useEffect(() => {
    if (selectedIngredient) {
      loadHistory(selectedIngredient);
    }
  }, [selectedIngredient]);

  const loadPrices = async () => {
    try {
      const data = await api.prices.list();
      setPrices(data);
    } catch {
      setPrices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (name: string) => {
    try {
      const data = await api.prices.history(name);
      const formatted = data.map((item: any) => ({
        date: new Date(item.recordedAt).toLocaleDateString(),
        price: item.price,
      }));
      setHistory(formatted);
    } catch {
      setHistory([]);
    }
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.prices.add({
        ...newPrice,
        price: parseFloat(newPrice.price),
      });
      setShowAddModal(false);
      setNewPrice({ ingredientName: '', price: '', unit: '100g', marketName: '' });
      loadPrices();
      if (selectedIngredient === newPrice.ingredientName) {
        loadHistory(newPrice.ingredientName);
      }
    } catch (err: any) {
      alert(err.message || '添加失败');
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
          <h1 className="text-2xl font-bold text-gray-800">食材价格追踪</h1>
          <p className="text-gray-500 mt-1">查看和记录食材市场价格变化</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          记录价格
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {prices.map((price) => (
          <button
            key={price.id}
            onClick={() => setSelectedIngredient(price.ingredientName)}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              selectedIngredient === price.ingredientName
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-100 bg-white hover:border-orange-200'
            }`}
          >
            <p className="text-sm text-gray-500 mb-1">{price.ingredientName}</p>
            <p className="text-xl font-bold text-gray-800">
              ¥{price.price}
              <span className="text-xs font-normal text-gray-400 ml-1">/{price.unit}</span>
            </p>
            {price.marketName && (
              <p className="text-xs text-gray-400 mt-1">{price.marketName}</p>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-gray-800">
            {selectedIngredient} 价格趋势
          </h2>
        </div>
        <div className="h-64">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: number) => [`¥${value}`, '价格']}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ fill: '#f97316', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              暂无历史价格数据
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">记录食材价格</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPrice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  食材名称
                </label>
                <input
                  type="text"
                  value={newPrice.ingredientName}
                  onChange={(e) =>
                    setNewPrice({ ...newPrice, ingredientName: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="如：鸡胸肉"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    价格 (元)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPrice.price}
                    onChange={(e) =>
                      setNewPrice({ ...newPrice, price: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    单位
                  </label>
                  <select
                    value={newPrice.unit}
                    onChange={(e) =>
                      setNewPrice({ ...newPrice, unit: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  >
                    <option value="100g">每100克</option>
                    <option value="500g">每500克</option>
                    <option value="1kg">每千克</option>
                    <option value="个">每个</option>
                    <option value="斤">每斤</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  来源市场
                </label>
                <input
                  type="text"
                  value={newPrice.marketName}
                  onChange={(e) =>
                    setNewPrice({ ...newPrice, marketName: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="如：永辉超市"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                保存记录
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
