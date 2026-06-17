import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Save,
  ClipboardCopy,
  Share2,
  Check,
  Leaf,
  Beef,
  Milk,
  Wheat,
  FlaskConical,
  Package,
  Loader2,
  AlertCircle,
  UtensilsCrossed,
} from 'lucide-react';
import type { ShoppingItem } from '@shared/types';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import { useAuthStore } from '@/stores/authStore';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  蔬菜: { label: '蔬菜', icon: <Leaf size={18} />, color: 'text-green-600', bg: 'bg-green-50' },
  肉类: { label: '肉类', icon: <Beef size={18} />, color: 'text-red-600', bg: 'bg-red-50' },
  蛋奶: { label: '蛋奶', icon: <Milk size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
  主食: { label: '主食', icon: <Wheat size={18} />, color: 'text-yellow-700', bg: 'bg-yellow-50' },
  调料: { label: '调料', icon: <FlaskConical size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
  其他: { label: '其他', icon: <Package size={18} />, color: 'text-gray-600', bg: 'bg-gray-50' },
};

const CATEGORY_ORDER = ['蔬菜', '肉类', '蛋奶', '主食', '调料', '其他'];

function groupByCategory(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
  return items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    const cat = CATEGORY_CONFIG[item.category] ? item.category : '其他';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
}

export default function ShoppingList() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    planId,
    shoppingList,
    totalPrice,
    fetchShoppingList,
    saveShoppingList,
    exportShoppingList,
    fetchSavedShoppingList,
  } = useMealPlanStore();

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setLoading(true);
      await fetchSavedShoppingList();
      await fetchShoppingList();
      setLoading(false);
    })();
  }, [isAuthenticated, fetchShoppingList, fetchSavedShoppingList]);

  useEffect(() => {
    setItems(shoppingList);
  }, [shoppingList]);

  const purchasedCount = items.filter((i) => i.purchased).length;
  const totalCount = items.length;
  const grouped = groupByCategory(items);
  const calculatedTotal = items.reduce((sum, i) => sum + i.estimatedPrice, 0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const togglePurchased = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, purchased: !item.purchased } : item))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveShoppingList(items);
      showToast('购物清单已保存');
    } catch {
      showToast('保存失败');
    }
    setSaving(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const text = await exportShoppingList();
      if (text) {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板');
      }
    } catch {
      showToast('导出失败');
    }
    setExporting(false);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const lines: string[] = ['🛒 我的购物清单\n'];
      for (const cat of CATEGORY_ORDER) {
        const catItems = grouped[cat];
        if (!catItems || catItems.length === 0) continue;
        lines.push(`【${cat}】`);
        for (const item of catItems) {
          const check = item.purchased ? '✅' : '⬜';
          lines.push(`  ${check} ${item.name} ${item.totalAmount}${item.unit} ¥${item.estimatedPrice.toFixed(2)}`);
        }
        lines.push('');
      }
      lines.push(`💰 合计: ¥${calculatedTotal.toFixed(2)}`);
      lines.push(`📋 进度: ${purchasedCount}/${totalCount} 已购买`);
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('分享文本已复制到剪贴板');
    } catch {
      showToast('分享失败');
    }
    setSharing(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <UtensilsCrossed className="w-16 h-16 mb-4" />
        <p className="text-lg">请先登录以查看采购清单</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (!planId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-500">
        <ShoppingCart size={48} className="text-gray-300" />
        <p className="text-lg">暂无饮食计划</p>
        <p className="text-sm">请先创建饮食计划以生成购物清单</p>
        <button
          onClick={() => navigate('/meal-plan')}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          前往创建
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-500">
        <AlertCircle size={48} className="text-gray-300" />
        <p className="text-lg">购物清单为空</p>
        <p className="text-sm">饮食计划中没有可购买的食材</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart size={28} className="text-blue-500" />
          购物清单
        </h1>
        <div className="text-sm text-gray-500">
          {purchasedCount}/{totalCount} 已购买
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
        <div
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${totalCount > 0 ? (purchasedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const catItems = grouped[cat];
        if (!catItems || catItems.length === 0) return null;
        const config = CATEGORY_CONFIG[cat];

        return (
          <div key={cat} className="mb-5">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${config.bg}`}>
              <span className={config.color}>{config.icon}</span>
              <span className={`font-semibold ${config.color}`}>{config.label}</span>
              <span className="text-xs text-gray-400 ml-1">({catItems.length})</span>
            </div>
            <div className="border border-t-0 border-gray-200 rounded-b-lg divide-y divide-gray-100">
              {catItems.map((item) => {
                const globalIndex = items.findIndex(
                  (i) => i.name === item.name && i.category === item.category
                );
                return (
                  <div
                    key={`${item.name}-${item.category}`}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 transition"
                  >
                    <button
                      onClick={() => togglePurchased(globalIndex)}
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        item.purchased
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {item.purchased && <Check size={14} />}
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        item.purchased ? 'line-through text-gray-400' : 'text-gray-800'
                      }`}
                    >
                      {item.name}
                    </span>
                    <span
                      className={`text-xs ${
                        item.purchased ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {item.totalAmount}{item.unit}
                    </span>
                    <span
                      className={`text-sm font-medium min-w-[52px] text-right ${
                        item.purchased ? 'text-gray-300' : 'text-orange-500'
                      }`}
                    >
                      ¥{item.estimatedPrice.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
        <span className="text-gray-600 font-medium">合计</span>
        <span className="text-xl font-bold text-blue-600">¥{totalPrice > 0 ? totalPrice.toFixed(2) : calculatedTotal.toFixed(2)}</span>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-center gap-3 z-50">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 text-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存清单
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 text-sm"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCopy size={16} />}
          导出文本
        </button>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition disabled:opacity-50 text-sm"
        >
          {sharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
          分享链接
        </button>
      </div>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
