import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  ChefHat,
  Home,
  BookOpen,
  Calendar,
  ShoppingCart,
  BarChart3,
  User,
  LogIn,
  LogOut,
  Lightbulb,
  Menu,
  X,
  Plus,
  TrendingUp,
  Layers,
  Trophy,
  Settings,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/recipes', label: '菜谱', icon: BookOpen },
  { path: '/collections', label: '合集', icon: Layers },
  { path: '/challenges', label: '挑战', icon: Trophy },
  { path: '/meal-plan', label: '膳食计划', icon: Calendar },
  { path: '/shopping', label: '采购清单', icon: ShoppingCart },
  { path: '/nutrition', label: '营养', icon: BarChart3 },
  { path: '/prices', label: '物价', icon: TrendingUp },
  { path: '/recommend', label: '推荐', icon: Lightbulb },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, checkAuth } = useAuthStore();
  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      await useAuthStore.getState().login(loginForm.username, loginForm.password);
      setShowLogin(false);
      setLoginForm({ username: '', password: '' });
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-orange-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-orange-600 font-bold text-xl no-underline">
            <ChefHat className="w-7 h-7" />
            <span className="hidden sm:inline">味知食谱</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all no-underline ${
                    active
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <Link
                to="/create-recipe"
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors no-underline"
              >
                <Plus className="w-4 h-4" />
                发布菜谱
              </Link>
            )}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <Link
                  to={`/profile/${user.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all no-underline"
                >
                  <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                  <span className="text-sm font-medium hidden sm:inline">{user.username}</span>
                </Link>
                <Link
                  to="/settings"
                  className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                  title="设置"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                登录
              </button>
            )}
            <button
              className="md:hidden p-2 text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-orange-100 bg-white/95 backdrop-blur-md">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-6 py-3 text-sm font-medium no-underline ${
                    active ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-orange-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowLogin(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">登录味知食谱</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                  placeholder="输入用户名"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                  placeholder="输入密码"
                  required
                />
              </div>
              {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                登录
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">
              预置账号: 美食达人小王 / 123456
            </p>
            <button onClick={() => setShowLogin(false)} className="mt-4 w-full text-gray-400 text-sm hover:text-gray-600">
              取消
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-orange-100 bg-white/60 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-400">
          味知食谱 - 菜谱分享与每周膳食计划
        </div>
      </footer>
    </div>
  );
}
