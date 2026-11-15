import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Clock,
  LogOut,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../lib/api';
import { FEATURED_SAMOSA_IMAGE } from '../../lib/foodAssets';
import { formatCurrency, formatDateTime } from '../../lib/format';
import {
  AppNotification,
  FoodStall,
  MenuItem,
  Order,
  OrderStatus,
  PlatformSettings,
} from '../../types';
import { FoodImage } from '../common/FoodImage';
import { MenuCardSkeleton } from '../common/Skeletons';
import { OrderStatusLabel } from '../common/StatusBadge';
import { CartDrawer } from './CartDrawer';

interface StudentDashboardProps {
  initialStallId?: string;
  initialCategory?: string;
  onBackToLanding: () => void;
  onOpenAuth: () => void;
}

const LIFECYCLE_STEPS: OrderStatus[] = [
  'Placed',
  'Accepted',
  'Preparing',
  'Ready',
  'Completed',
];

function getIndianGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function StudentDashboard({
  initialStallId,
  initialCategory,
  onBackToLanding,
  onOpenAuth,
}: StudentDashboardProps) {
  const { user, logout } = useAuth();
  const { entries, totalItemsCount, addToCart, updateQuantity, syncItemStock } = useCart();
  const { showToast, confirmAction } = useToast();

  const [tab, setTab] = useState<'explore' | 'orders' | 'notifications'>('explore');
  const [stalls, setStalls] = useState<FoodStall[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const [selectedStallId, setSelectedStallId] = useState<string>(initialStallId || 'All');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  const [loadingMenu, setLoadingMenu] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setSelectedStallId(initialStallId || 'All');
  }, [initialStallId]);

  useEffect(() => {
    setSelectedCategory(initialCategory || 'All');
  }, [initialCategory]);

  const loadCatalog = useCallback(async () => {
    try {
      const [stallRes, menuRes, settingsRes] = await Promise.all([
        apiRequest<{ stalls: FoodStall[] }>('/api/stalls'),
        apiRequest<{ items: MenuItem[]; categories: string[] }>('/api/menu'),
        apiRequest<{ settings: PlatformSettings }>('/api/admin/settings'),
      ]);
      setStalls(stallRes.stalls);
      setMenuItems(menuRes.items);
      setCategories(['All', ...menuRes.categories]);
      setSettings(settingsRes.settings);
      syncItemStock(menuRes.items);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load menu', 'error');
    } finally {
      setLoadingMenu(false);
    }
  }, [showToast, syncItemStock]);

  const loadStudentActivity = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try {
      const [ordRes, notifRes] = await Promise.all([
        apiRequest<{ orders: Order[] }>('/api/orders/my-orders'),
        apiRequest<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications'),
      ]);
      setOrders(ordRes.orders);
      setNotifications(notifRes.notifications);
      setUnreadCount(notifRes.unreadCount);
    } catch {
      // background poll errors ignored gracefully
    }
  }, [user]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (user?.role === 'student') {
      setLoadingOrders(true);
      loadStudentActivity().finally(() => setLoadingOrders(false));
      const timer = setInterval(() => {
        loadStudentActivity();
        loadCatalog();
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [user, loadStudentActivity, loadCatalog]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedStallId !== 'All' && item.stall_id !== selectedStallId) return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (vegOnly && !item.is_veg) return false;
      if (inStockOnly && (item.stock_qty <= 0 || !item.is_available)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.stall_name || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [menuItems, selectedStallId, selectedCategory, vegOnly, inStockOnly, searchQuery]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => map.set(e.item.id, e.quantity));
    return map;
  }, [entries]);

  const activeOrdersCount = useMemo(
    () =>
      orders.filter((o) => ['Placed', 'Accepted', 'Preparing', 'Ready'].includes(o.status)).length,
    [orders]
  );

  const cancellableList = useMemo(
    () =>
      (settings?.cancellable_statuses || 'Placed,Accepted')
        .split(',')
        .map((s) => s.trim()),
    [settings]
  );

  const handleCancelOrder = async (order: Order) => {
    const confirmed = await confirmAction({
      title: `Cancel Order ${order.order_code}?`,
      message: `Your order from ${order.stall_name} will be cancelled, reserved stock will be restored immediately, and ${formatCurrency(order.total_amount)} (${order.payment_method}) will be refunded.`,
      confirmLabel: 'Yes, Cancel Order',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await apiRequest(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by student from dashboard' }),
      });
      showToast(`Order ${order.order_code} cancelled and stock restored.`, 'success');
      await Promise.all([loadStudentActivity(), loadCatalog()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to cancel order.', 'error');
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#1C1917]">
      {/* Midnight Navy 3-Zone Workspace Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-b border-white/10 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 font-display cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#FBBF24]" />
            <span>CampusBite</span>
          </button>

          <nav className="flex items-center gap-5 sm:gap-7 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setTab('explore')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                tab === 'explore'
                  ? 'text-white font-semibold underline underline-offset-8 decoration-[#F97316] decoration-2'
                  : 'hover:text-white'
              }`}
            >
              Explore Menu
            </button>
            {user?.role === 'student' && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('orders')}
                  className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    tab === 'orders'
                      ? 'text-white font-semibold underline underline-offset-8 decoration-[#F97316] decoration-2'
                      : 'hover:text-white'
                  }`}
                >
                  My Orders ({orders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('notifications')}
                  className={`whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    tab === 'notifications'
                      ? 'text-white font-semibold underline underline-offset-8 decoration-[#F97316] decoration-2'
                      : 'hover:text-white'
                  }`}
                >
                  <Bell className="w-4 h-4 text-[#FBBF24]" />
                  <span>Alerts {unreadCount > 0 ? `(${unreadCount})` : ''}</span>
                </button>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="font-mono tabular-nums">Cart ({totalItemsCount})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Personalized Greeting & Account Header */}
        <section className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div>
            <p className="text-xs font-bold tracking-wider text-[#EA580C]">
              {(settings?.campus_name || 'IIIT ALLAHABAD CAMPUS FOOD COURT').toUpperCase()} · PRAYAGRAJ
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
              {tab === 'explore'
                ? `${getIndianGreeting()}, ${user ? user.name.split(' ')[0] : 'IIITA Explorer'}`
                : tab === 'orders'
                  ? 'Live Order Tracking & History'
                  : 'Order & Kitchen Alerts'}
            </h1>
            <p className="mt-1 text-sm text-[#57534E]">
              {user
                ? `Signed in as ${user.name} (${user.campusId || user.email})`
                : 'Browsing live IIIT Allahabad demo stall menus as guest — sign in when ready to checkout.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {user?.role === 'student' && activeOrdersCount > 0 && tab !== 'orders' && (
              <button
                type="button"
                onClick={() => setTab('orders')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B132B] text-white text-xs font-semibold hover:bg-[#111C3A] transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>{activeOrdersCount} Active Order(s)</span>
              </button>
            )}
            {user ? (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-[#111C3A] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Student Sign In
              </button>
            )}
          </div>
        </section>

        {/* TAB 1: EXPLORE MENU */}
        {tab === 'explore' && (
          <div className="space-y-8">
            {/* Featured Indian Campus Spotlight Banner */}
            <section className="rounded-2xl bg-gradient-to-r from-[#0B132B] via-[#111C3A] to-[#1E2E5C] text-white p-6 sm:p-8 border border-[#1E2E5C] grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-lg">
              <div className="lg:col-span-8 space-y-3">
                <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-[#FBBF24]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>CAMPUS FAVORITES · FRESHLY PREPARED</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Hot Samosa & Masala Chai at ₹55, or Schedule Lunch Before Your 1 PM Break
                </h2>
                <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                  All listed dishes reflect real-time stall inventory across IIIT Allahabad Demo Counters 01–04. Reserve now and skip the counter queue.
                </p>
                <div className="pt-1 flex flex-wrap gap-2.5">
                  {['Snacks & Samosa', 'North Indian Meals', 'Dosa & South Indian', 'Momos', 'Cold Coffee & Chai'].map(
                    (quickCat) => (
                      <button
                        key={quickCat}
                        type="button"
                        onClick={() => setSelectedCategory(quickCat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          selectedCategory === quickCat
                            ? 'bg-[#F97316] text-white'
                            : 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/10'
                        }`}
                      >
                        {quickCat}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="lg:col-span-4">
                <div className="aspect-[16/10] rounded-xl overflow-hidden border border-white/15 shadow-md">
                  <FoodImage
                    src={FEATURED_SAMOSA_IMAGE}
                    alt="Punjabi Samosa and Masala Chai combo"
                  />
                </div>
              </div>
            </section>

            {/* Demo Food Stalls Filter Row */}
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h2 className="text-base font-bold text-[#0B132B]">
                    Demo Food Stalls · IIIT Allahabad
                  </h2>
                  <p className="text-xs text-[#57534E]">
                    Select a counter to filter its live menu or browse all stalls together.
                  </p>
                </div>
                {selectedStallId !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setSelectedStallId('All')}
                    className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
                  >
                    Show All Stalls
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stalls.map((stall) => {
                  const isSelected = selectedStallId === stall.id;
                  return (
                    <button
                      key={stall.id}
                      type="button"
                      onClick={() => setSelectedStallId(isSelected ? 'All' : stall.id)}
                      className={`text-left rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col ${
                        isSelected
                          ? 'bg-[#FFFDF9] border-[#EA580C] ring-2 ring-[#F97316]/20 shadow-md'
                          : 'bg-[#FFFDF9] border-[#E6DEC8] hover:border-[#D4A017] hover:shadow-sm'
                      }`}
                    >
                      <div className="aspect-[16/9] w-full bg-[#F2EAE0] overflow-hidden relative">
                        <FoodImage src={stall.image_url} alt={stall.name} />
                        <span
                          className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                            stall.is_open
                              ? 'bg-[#0B132B]/90 text-emerald-300'
                              : 'bg-rose-950/90 text-rose-200'
                          }`}
                        >
                          {stall.is_open ? 'Open Now' : 'Closed'}
                        </span>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-sm font-bold text-[#0B132B]">
                            <Store className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                            <span className="truncate">{stall.name}</span>
                          </div>
                          <p className="mt-1 text-xs text-[#57534E] truncate">
                            {stall.cuisine_type}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#57534E] truncate">
                            {stall.location}
                          </p>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-[#F2EAE0] flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="inline-flex items-center gap-1 font-bold text-[#0B132B]">
                            <Star className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" />
                            {stall.rating.toFixed(1)}
                          </span>
                          <span className="text-[#57534E]">~{stall.avg_prep_minutes}m prep</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Search + Category Strip + Toggles Toolbar */}
            <section className="bg-[#FFFDF9] p-4 sm:p-5 rounded-2xl border border-[#E6DEC8] space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#57534E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search samosa, dosa, momos, cold coffee, or stall..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#EA580C]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B132B] cursor-pointer select-none px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8]">
                    <input
                      type="checkbox"
                      checked={vegOnly}
                      onChange={(e) => setVegOnly(e.target.checked)}
                      className="rounded border-[#E6DEC8] text-emerald-600 focus:ring-emerald-600"
                    />
                    <span>Pure Veg Only</span>
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B132B] cursor-pointer select-none px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8]">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="rounded border-[#E6DEC8] text-[#EA580C] focus:ring-[#EA580C]"
                    />
                    <span>In Stock Only</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#0B132B] text-white shadow-xs'
                        : 'bg-[#FAF6EE] text-[#57534E] border border-[#E6DEC8] hover:text-[#0B132B] hover:border-[#D4A017]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            {/* Menu Grid */}
            {loadingMenu ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <MenuCardSkeleton />
                <MenuCardSkeleton />
                <MenuCardSkeleton />
                <MenuCardSkeleton />
                <MenuCardSkeleton />
                <MenuCardSkeleton />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] py-16 px-6 text-center">
                <h3 className="text-lg font-bold text-[#0B132B]">No matching dishes found</h3>
                <p className="mt-1.5 text-sm text-[#57534E]">
                  Try clearing your search query or switching demo stall and category filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStallId('All');
                    setSelectedCategory('All');
                    setSearchQuery('');
                    setVegOnly(false);
                    setInStockOnly(false);
                  }}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-semibold hover:bg-[#C2410C] transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => {
                  const inCartQty = cartQtyMap.get(item.id) || 0;
                  const unavailable =
                    !item.is_available || item.stock_qty <= 0 || item.stall_is_open === 0;
                  const isLowStock =
                    item.stock_qty > 0 && item.stock_qty <= item.low_stock_threshold;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden flex flex-col transition-all duration-150 ${
                        unavailable
                          ? 'opacity-75'
                          : 'hover:-translate-y-0.5 hover:shadow-lg hover:border-[#D4A017]'
                      }`}
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2EAE0] relative">
                        <FoodImage src={item.image_url} alt={item.name} />
                        {Boolean(item.is_bestseller) && !unavailable && (
                          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#0B132B]/90 text-[#FBBF24] text-[11px] font-bold">
                            Bestseller
                          </span>
                        )}
                        {unavailable && (
                          <div className="absolute inset-0 bg-[#0B132B]/55 flex items-center justify-center">
                            <span className="px-3.5 py-1.5 rounded-xl bg-[#FFFDF9] text-[#0B132B] text-xs font-bold shadow-sm">
                              {item.stall_is_open === 0 ? 'Stall Closed' : 'Out of Stock'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-center justify-between gap-2 text-xs text-[#57534E]">
                          <span className="truncate font-medium">{item.stall_name}</span>
                          {/* Indian FSSAI-style Veg/Non-Veg mark */}
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold shrink-0 ${
                              item.is_veg ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center ${
                                item.is_veg ? 'border-emerald-700' : 'border-rose-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.is_veg ? 'bg-emerald-700' : 'bg-rose-700'
                                }`}
                              />
                            </span>
                            <span>{item.is_veg ? 'Veg' : 'Non-Veg'}</span>
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-bold text-[#0B132B]">{item.name}</h3>
                        <p className="mt-1 text-sm text-[#57534E] line-clamp-2 leading-relaxed flex-1">
                          {item.description}
                        </p>

                        <div className="mt-3.5 flex items-center justify-between text-xs text-[#57534E]">
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                            {item.prep_minutes}m prep
                          </span>
                          <span
                            className={`font-mono tabular-nums font-semibold ${
                              item.stock_qty === 0
                                ? 'text-rose-700'
                                : isLowStock
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {item.stock_qty === 0
                              ? '0 left'
                              : isLowStock
                                ? `Only ${item.stock_qty} left`
                                : `${item.stock_qty} in stock`}
                          </span>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-[#F2EAE0] flex items-center justify-between gap-3">
                          <span className="text-lg font-bold text-[#0B132B] font-mono tabular-nums">
                            {formatCurrency(item.price)}
                          </span>

                          {inCartQty > 0 ? (
                            <div className="inline-flex items-center rounded-xl border border-[#EA580C] bg-orange-50">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, inCartQty - 1)}
                                aria-label={`Decrease ${item.name}`}
                                className="p-2 text-[#EA580C] hover:bg-orange-100 rounded-l-xl cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-3 text-xs font-mono font-bold text-[#0B132B] tabular-nums">
                                {inCartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, inCartQty + 1)}
                                aria-label={`Increase ${item.name}`}
                                className="p-2 text-[#EA580C] hover:bg-orange-100 rounded-r-xl cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={unavailable}
                              onClick={() => addToCart(item, 1)}
                              className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] disabled:bg-[#E6DEC8] disabled:text-[#57534E] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
                            >
                              {unavailable ? 'Unavailable' : 'Add to Cart'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY ORDERS & LIVE TRACKING */}
        {tab === 'orders' && user?.role === 'student' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-[#57534E]">
                Live status updates refresh automatically. Cancellation with instant stock restoration is allowed while status is{' '}
                <span className="font-semibold text-[#0B132B]">
                  {cancellableList.join(' or ')}
                </span>
                .
              </p>
              <button
                type="button"
                onClick={() => loadStudentActivity()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E6DEC8] bg-[#FFFDF9] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer w-fit"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
            </div>

            {loadingOrders ? (
              <div className="grid gap-4">
                <MenuCardSkeleton />
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] py-16 px-6 text-center">
                <h3 className="text-lg font-bold text-[#0B132B]">No orders placed yet</h3>
                <p className="mt-1.5 text-sm text-[#57534E]">
                  Explore the IIIT Allahabad demo food court menu and place your first order.
                </p>
                <button
                  type="button"
                  onClick={() => setTab('explore')}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-semibold hover:bg-[#EA580C] transition-colors cursor-pointer"
                >
                  Browse Food Stalls
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {orders.map((order) => {
                  const canCancel = cancellableList.includes(order.status);
                  const isTerminalNegative =
                    order.status === 'Cancelled' || order.status === 'Rejected';
                  const currentStepIndex = LIFECYCLE_STEPS.indexOf(order.status);

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6 space-y-5 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-mono text-base font-bold text-[#0B132B]">
                              {order.order_code}
                            </span>
                            <OrderStatusLabel status={order.status} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                            <span className="font-semibold text-[#0B132B]">
                              {order.stall_name}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#EA580C]" />
                              {order.stall_location}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Pickup: {order.pickup_time}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatDateTime(order.created_at)}</span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <div className="text-lg font-bold text-[#0B132B] font-mono tabular-nums">
                            {formatCurrency(order.total_amount)}
                          </div>
                          <div className="text-xs text-[#57534E]">
                            {order.payment_method} ·{' '}
                            <span className="font-semibold text-[#0B132B]">
                              {order.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Order Lifecycle Progress Bar */}
                      {!isTerminalNegative ? (
                        <div className="grid grid-cols-5 gap-2.5 pt-2">
                          {LIFECYCLE_STEPS.map((step, idx) => {
                            const reached = idx <= currentStepIndex;
                            return (
                              <div key={step} className="space-y-1.5">
                                <div
                                  className={`h-2 rounded-full transition-colors ${
                                    reached ? 'bg-[#F97316]' : 'bg-[#F2EAE0]'
                                  }`}
                                />
                                <div className="flex items-center gap-1 text-[11px] font-medium">
                                  {reached && (
                                    <Check className="w-3 h-3 text-[#EA580C] shrink-0" />
                                  )}
                                  <span
                                    className={
                                      reached ? 'text-[#0B132B] font-bold' : 'text-[#57534E]'
                                    }
                                  >
                                    {step}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] px-3.5 py-2.5 text-xs text-[#57534E] flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            {order.status}:{' '}
                            {order.cancellation_reason || 'Order closed and stock restored.'}
                          </span>
                        </div>
                      )}

                      {/* Line Items & Cancel Button */}
                      <div className="pt-4 border-t border-[#F2EAE0] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="space-y-1.5 text-sm">
                          {order.items.map((it) => (
                            <div key={it.id} className="flex items-center gap-3">
                              <span className="font-mono text-xs font-bold text-[#EA580C] tabular-nums">
                                {it.quantity}x
                              </span>
                              <span className="text-[#0B132B] font-medium">{it.item_name}</span>
                              <span className="text-xs font-mono text-[#57534E] tabular-nums">
                                ({formatCurrency(it.line_total)})
                              </span>
                            </div>
                          ))}
                          {order.special_instructions && (
                            <p className="text-xs text-[#57534E] pt-1">
                              Kitchen note: {order.special_instructions}
                            </p>
                          )}
                        </div>

                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(order)}
                            className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Cancel Order & Restore Stock
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS */}
        {tab === 'notifications' && user?.role === 'student' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleMarkNotificationsRead}
                className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
              >
                Mark all as read
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-12 text-center text-sm text-[#57534E]">
                No notifications yet. Order status updates will appear here.
              </div>
            ) : (
              <div className="divide-y divide-[#F2EAE0] rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 flex items-start justify-between gap-4 ${
                      n.is_read ? 'bg-[#FFFDF9]' : 'bg-orange-50/50'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#0B132B]">{n.title}</div>
                      <p className="text-xs text-[#57534E] mt-1">{n.message}</p>
                    </div>
                    <span className="text-[11px] font-mono text-[#57534E] whitespace-nowrap">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        settings={settings}
        onRequireLogin={onOpenAuth}
        onOrderPlaced={() => {
          loadCatalog();
          loadStudentActivity();
          setTab('orders');
        }}
      />
    </div>
  );
}
