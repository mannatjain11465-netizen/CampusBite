import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  Package,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../lib/api';
import { PRESET_FOOD_GALLERY } from '../../lib/foodAssets';
import { formatCurrency, formatDateTime } from '../../lib/format';
import {
  AppNotification,
  FoodStall,
  InventoryTransaction,
  MenuItem,
  Order,
  OrderStatus,
} from '../../types';
import { FoodImage } from '../common/FoodImage';
import { KpiSkeleton, TableRowSkeleton } from '../common/Skeletons';
import { OrderStatusLabel } from '../common/StatusBadge';

type VendorSection = 'overview' | 'orders' | 'menu' | 'inventory' | 'stall' | 'notifications';

interface VendorAnalytics {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    activeOrders: number;
    completedOrders: number;
    todayOrders: number;
    todayRevenue: number;
  };
  dailySales: { date: string; orders: number; revenue: number }[];
  topItems: { name: string; unitsSold: number; revenue: number }[];
}

export function VendorDashboard({ onBackToLanding }: { onBackToLanding: () => void }) {
  const { user, logout } = useAuth();
  const { showToast, confirmAction } = useToast();

  const [section, setSection] = useState<VendorSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [stall, setStall] = useState<FoodStall | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>('All');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<MenuItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [analytics, setAnalytics] = useState<VendorAnalytics | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    category: 'Snacks & Samosa',
    price: '80',
    imageUrl: PRESET_FOOD_GALLERY[0].url,
    isVeg: true,
    isBestseller: false,
    prepMinutes: '10',
    stockQty: '25',
    lowStockThreshold: '10',
    isAvailable: true,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const [restockTarget, setRestockTarget] = useState<MenuItem | null>(null);
  const [restockQty, setRestockQty] = useState('20');
  const [restockNote, setRestockNote] = useState('Fresh kitchen batch restocked');

  const [stallForm, setStallForm] = useState({
    name: '',
    description: '',
    cuisineType: '',
    location: '',
    openingHours: '',
    avgPrepMinutes: '12',
    isOpen: true,
  });

  const loadVendorData = useCallback(async () => {
    try {
      const [stallRes, ordRes, invRes, analyticsRes, notifRes] = await Promise.all([
        apiRequest<{ stall: FoodStall }>('/api/stalls/my-stall'),
        apiRequest<{ orders: Order[] }>('/api/orders/vendor-orders'),
        apiRequest<{
          items: MenuItem[];
          lowStockItems: MenuItem[];
          transactions: InventoryTransaction[];
        }>('/api/inventory/vendor'),
        apiRequest<VendorAnalytics>('/api/admin/vendor-analytics'),
        apiRequest<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications'),
      ]);

      setStall(stallRes.stall);
      setStallForm({
        name: stallRes.stall.name,
        description: stallRes.stall.description,
        cuisineType: stallRes.stall.cuisine_type,
        location: stallRes.stall.location,
        openingHours: stallRes.stall.opening_hours,
        avgPrepMinutes: String(stallRes.stall.avg_prep_minutes),
        isOpen: Boolean(stallRes.stall.is_open),
      });
      setOrders(ordRes.orders);
      setMenuItems(invRes.items);
      setLowStockItems(invRes.lowStockItems);
      setTransactions(invRes.transactions);
      setAnalytics(analyticsRes);
      setNotifications(notifRes.notifications);
      setUnreadCount(notifRes.unreadCount);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load vendor dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadVendorData();
    const timer = setInterval(loadVendorData, 8000);
    return () => clearInterval(timer);
  }, [loadVendorData]);

  const handleOrderTransition = async (order: Order, nextStatus: OrderStatus) => {
    if (nextStatus === 'Rejected') {
      const ok = await confirmAction({
        title: `Reject Order ${order.order_code}?`,
        message:
          'Rejecting this order will automatically restore reserved inventory and mark the simulated payment as refunded.',
        confirmLabel: 'Reject & Refund',
        destructive: true,
      });
      if (!ok) return;
    }

    try {
      await apiRequest(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`Order ${order.order_code} updated to ${nextStatus}`, 'success');
      await loadVendorData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update order status', 'error');
    }
  };

  const openCreateItemModal = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      description: '',
      category: 'Snacks & Samosa',
      price: '80',
      imageUrl: PRESET_FOOD_GALLERY[0].url,
      isVeg: true,
      isBestseller: false,
      prepMinutes: '10',
      stockQty: '25',
      lowStockThreshold: '10',
      isAvailable: true,
    });
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      category: item.category,
      price: String(item.price),
      imageUrl: item.image_url,
      isVeg: Boolean(item.is_veg),
      isBestseller: Boolean(item.is_bestseller),
      prepMinutes: String(item.prep_minutes),
      stockQty: String(item.stock_qty),
      lowStockThreshold: String(item.low_stock_threshold),
      isAvailable: Boolean(item.is_available),
    });
    setItemModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiRequest<{ imageUrl: string }>('/api/menu/upload', {
        method: 'POST',
        body: formData,
      });
      setItemForm((prev) => ({ ...prev, imageUrl: res.imageUrl }));
      showToast('Food photo uploaded successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: itemForm.name,
        description: itemForm.description,
        category: itemForm.category,
        price: Number(itemForm.price),
        imageUrl: itemForm.imageUrl,
        isVeg: itemForm.isVeg,
        isBestseller: itemForm.isBestseller,
        prepMinutes: Number(itemForm.prepMinutes),
        stockQty: Number(itemForm.stockQty),
        lowStockThreshold: Number(itemForm.lowStockThreshold),
        isAvailable: itemForm.isAvailable,
      };

      if (editingItem) {
        await apiRequest(`/api/menu/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast(`Updated ${itemForm.name}`, 'success');
      } else {
        await apiRequest('/api/menu', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Added ${itemForm.name} to stall menu`, 'success');
      }
      setItemModalOpen(false);
      await loadVendorData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save menu item', 'error');
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await apiRequest(`/api/menu/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !item.is_available }),
      });
      showToast(
        `${item.name} marked as ${!item.is_available ? 'Available' : 'Unavailable'}`,
        'success'
      );
      await loadVendorData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle availability', 'error');
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    const ok = await confirmAction({
      title: `Remove ${item.name}?`,
      message:
        'If this item has past orders, it will be safely archived as unavailable to preserve order history; otherwise it will be deleted.',
      confirmLabel: 'Remove Item',
      destructive: true,
    });
    if (!ok) return;

    try {
      const res = await apiRequest<{ message: string }>(`/api/menu/${item.id}`, {
        method: 'DELETE',
      });
      showToast(res.message, 'info');
      await loadVendorData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove item', 'error');
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    try {
      await apiRequest('/api/inventory/restock', {
        method: 'POST',
        body: JSON.stringify({
          menuItemId: restockTarget.id,
          quantity: Number(restockQty),
          note: restockNote,
          makeAvailable: true,
        }),
      });
      showToast(`Restocked ${restockTarget.name} (+${restockQty} units)`, 'success');
      setRestockTarget(null);
      await loadVendorData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Restock failed', 'error');
    }
  };

  const handleSaveStall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stall) return;
    try {
      await apiRequest(`/api/stalls/${stall.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: stallForm.name,
          description: stallForm.description,
          cuisineType: stallForm.cuisineType,
          location: stallForm.location,
          openingHours: stallForm.openingHours,
          avgPrepMinutes: Number(stallForm.avgPrepMinutes),
          isOpen: stallForm.isOpen,
        }),
      });
      showToast('Stall details updated', 'success');
      await loadVendorData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update stall', 'error');
    }
  };

  const filteredOrders =
    orderFilter === 'All' ? orders : orders.filter((o) => o.status === orderFilter);

  const navItems: {
    id: VendorSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Overview & Sales', icon: BarChart3 },
    {
      id: 'orders',
      label: 'Incoming Orders',
      icon: ClipboardList,
      badge: orders.filter((o) => ['Placed', 'Accepted', 'Preparing', 'Ready'].includes(o.status))
        .length,
    },
    { id: 'menu', label: 'Menu Items', icon: UtensilsCrossed },
    {
      id: 'inventory',
      label: 'Inventory & Stock',
      icon: Package,
      badge: lowStockItems.length,
    },
    { id: 'stall', label: 'Stall Profile', icon: Store },
    { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#1C1917] flex">
      {/* Midnight Navy Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-68 bg-[#0B132B] text-white border-r border-white/10 flex flex-col transition-transform duration-150 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-white font-display cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#FBBF24]" />
            <span>CampusBite</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1.5 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-[11px] font-bold tracking-wider text-[#FBBF24]">
            IIIT ALLAHABAD · VENDOR KITCHEN
          </p>
          <p className="text-sm font-bold text-white truncate mt-1">
            {stall?.name || 'Loading stall...'}
          </p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {stall ? (stall.is_open ? 'Counter Open' : 'Counter Closed') : ''}
          </p>
        </div>

        <nav className="flex-1 p-3.5 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#F97316] text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums px-2 py-0.5 rounded-md ${
                      active
                        ? 'bg-[#0B132B]/40 text-white'
                        : 'bg-white/10 text-[#FBBF24]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2.5">
          <div className="text-xs font-medium text-slate-300 truncate">{user?.name}</div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 sm:px-8 bg-[#FFFDF9] border-b border-[#E6DEC8] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-xl border border-[#E6DEC8] bg-[#FAF6EE]"
            >
              <MenuIcon className="w-4 h-4 text-[#0B132B]" />
            </button>
            <div className="text-sm text-[#57534E] truncate">
              <span>Vendor Console</span>
              <span className="mx-2">/</span>
              <span className="font-bold text-[#0B132B]">
                {navItems.find((n) => n.id === section)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => loadVendorData()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
            <button
              type="button"
              onClick={openCreateItemModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Dish</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-8">
          {/* SECTION 1: OVERVIEW & ANALYTICS */}
          {section === 'overview' && (
            <>
              {loading || !analytics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-2xl bg-[#0B132B] text-white p-5 shadow-sm">
                      <p className="text-xs font-medium text-slate-300">Total Stall Revenue</p>
                      <p className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">
                        {formatCurrency(analytics.summary.totalRevenue)}
                      </p>
                      <p className="mt-1 text-xs text-[#FBBF24] font-mono tabular-nums">
                        Today: {formatCurrency(analytics.summary.todayRevenue)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <p className="text-xs font-medium text-[#57534E]">Active Kitchen Queue</p>
                      <p className="mt-2 text-2xl font-bold text-[#EA580C] font-mono tabular-nums">
                        {analytics.summary.activeOrders}
                      </p>
                      <p className="mt-1 text-xs text-[#57534E]">
                        Placed, preparing, or ready
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <p className="text-xs font-medium text-[#57534E]">Completed Orders</p>
                      <p className="mt-2 text-2xl font-bold text-[#0B132B] font-mono tabular-nums">
                        {analytics.summary.completedOrders}
                      </p>
                      <p className="mt-1 text-xs text-[#57534E] font-mono tabular-nums">
                        {analytics.summary.totalOrders} total lifetime
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <p className="text-xs font-medium text-[#57534E]">Low-Stock Items</p>
                      <p
                        className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
                          lowStockItems.length > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {lowStockItems.length}
                      </p>
                      <p className="mt-1 text-xs text-[#57534E]">
                        Items at or below threshold
                      </p>
                    </div>
                  </div>

                  {lowStockItems.length > 0 && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-bold text-amber-950">
                            {lowStockItems.length} menu item(s) need restocking
                          </h3>
                          <p className="text-xs text-amber-900 mt-1">
                            {lowStockItems
                              .map((i) => `${i.name} (${i.stock_qty} left)`)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSection('inventory')}
                        className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Restock Inventory
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <h3 className="text-sm font-bold text-[#0B132B] mb-4">
                        Daily Sales Revenue (₹)
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.dailySales}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6DEC8" />
                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#57534E' }} />
                            <YAxis tick={{ fontSize: 12, fill: '#57534E' }} />
                            <Tooltip
                              formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                            />
                            <Bar dataKey="revenue" fill="#F97316" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <h3 className="text-sm font-bold text-[#0B132B] mb-4">
                        Top Selling Dishes
                      </h3>
                      {analytics.topItems.length === 0 ? (
                        <p className="text-sm text-[#57534E] py-16 text-center">
                          No completed sales data yet.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {analytics.topItems.map((it) => (
                            <div
                              key={it.name}
                              className="flex items-center justify-between py-2.5 border-b border-[#F2EAE0] last:border-0 text-sm"
                            >
                              <span className="font-semibold text-[#0B132B] truncate pr-4">
                                {it.name}
                              </span>
                              <div className="flex items-center gap-4 shrink-0 font-mono text-xs tabular-nums">
                                <span className="text-[#57534E]">{it.unitsSold} sold</span>
                                <span className="font-bold text-[#0B132B]">
                                  {formatCurrency(it.revenue)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* SECTION 2: INCOMING ORDERS */}
          {section === 'orders' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F2EAE0] rounded-xl w-fit">
                {['All', 'Placed', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled'].map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderFilter(st)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        orderFilter === st
                          ? 'bg-[#0B132B] text-white shadow-xs'
                          : 'text-[#57534E] hover:text-[#0B132B]'
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>

              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[780px]">
                  <thead>
                    <tr className="border-b border-[#E6DEC8] bg-[#FAF6EE] text-xs font-bold text-[#0B132B]">
                      <th className="py-3.5 px-4">Order</th>
                      <th className="py-3.5 px-4">Student & Pickup</th>
                      <th className="py-3.5 px-4">Items</th>
                      <th className="py-3.5 px-4 text-right">Total</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Kitchen Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-sm">
                    {loading ? (
                      <TableRowSkeleton cols={6} />
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-sm text-[#57534E]">
                          No orders match the "{orderFilter}" filter.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#FAF6EE]/60">
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-mono font-bold text-xs text-[#0B132B]">
                              {order.order_code}
                            </div>
                            <div className="text-[11px] text-[#57534E] mt-0.5">
                              {formatDateTime(order.created_at)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-xs text-[#0B132B]">
                              {order.student_name}
                            </div>
                            <div className="text-xs text-[#57534E]">
                              Pickup: {order.pickup_time}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-0.5 text-xs">
                              {order.items.map((it) => (
                                <div key={it.id}>
                                  <span className="font-mono font-semibold text-[#EA580C]">
                                    {it.quantity}x
                                  </span>{' '}
                                  {it.item_name}
                                </div>
                              ))}
                              {order.special_instructions && (
                                <div className="text-[11px] text-amber-700 pt-0.5">
                                  Note: {order.special_instructions}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top text-right font-mono font-bold text-xs tabular-nums text-[#0B132B]">
                            {formatCurrency(order.total_amount)}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <OrderStatusLabel status={order.status} />
                          </td>
                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="inline-flex items-center gap-2">
                              {order.status === 'Placed' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOrderTransition(order, 'Accepted')}
                                    className="px-3 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOrderTransition(order, 'Rejected')}
                                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {order.status === 'Accepted' && (
                                <button
                                  type="button"
                                  onClick={() => handleOrderTransition(order, 'Preparing')}
                                  className="px-3 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                                >
                                  Start Preparing
                                </button>
                              )}
                              {order.status === 'Preparing' && (
                                <button
                                  type="button"
                                  onClick={() => handleOrderTransition(order, 'Ready')}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Mark Ready
                                </button>
                              )}
                              {order.status === 'Ready' && (
                                <button
                                  type="button"
                                  onClick={() => handleOrderTransition(order, 'Completed')}
                                  className="px-3 py-1.5 rounded-lg bg-[#0B132B] hover:bg-[#111C3A] text-white text-xs font-semibold cursor-pointer"
                                >
                                  Complete Pickup
                                </button>
                              )}
                              {['Completed', 'Rejected', 'Cancelled'].includes(order.status) && (
                                <span className="text-xs text-[#57534E]">Closed</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: MENU ITEMS */}
          {section === 'menu' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-[#F2EAE0]">
                    <FoodImage src={item.image_url} alt={item.name} />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between text-xs text-[#57534E]">
                      <span>
                        {item.category} · {item.is_veg ? 'Veg' : 'Non-Veg'}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#0B132B]">
                        Stock: {item.stock_qty}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-[#0B132B]">{item.name}</h3>
                    <p className="mt-1 text-xs text-[#57534E] line-clamp-2 flex-1">
                      {item.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-[#F2EAE0] flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-base tabular-nums text-[#0B132B]">
                        {formatCurrency(item.price)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            item.is_available
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-[#E6DEC8] bg-[#FAF6EE] text-[#57534E]'
                          }`}
                        >
                          {item.is_available ? 'Available' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditItemModal(item)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          aria-label={`Delete ${item.name}`}
                          className="p-1.5 rounded-lg text-[#57534E] hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SECTION 4: INVENTORY & RESTOCK */}
          {section === 'inventory' && (
            <div className="space-y-8">
              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-x-auto">
                <div className="px-5 py-4 border-b border-[#E6DEC8] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B132B]">Current Item Stock Levels</h3>
                  <span className="text-xs text-[#57534E]">
                    Automatic deductions occur atomically on order placement
                  </span>
                </div>
                <table className="w-full text-left border-collapse min-w-[680px]">
                  <thead>
                    <tr className="border-b border-[#E6DEC8] bg-[#FAF6EE] text-xs font-bold text-[#0B132B]">
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Stock Qty</th>
                      <th className="py-3 px-4 text-right">Alert Threshold</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-sm">
                    {menuItems.map((item) => {
                      const out = item.stock_qty === 0;
                      const low = !out && item.stock_qty <= item.low_stock_threshold;
                      return (
                        <tr key={item.id} className="hover:bg-[#FAF6EE]/60">
                          <td className="py-3 px-4 font-semibold text-[#0B132B]">{item.name}</td>
                          <td className="py-3 px-4 text-xs text-[#57534E]">{item.category}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                            {item.stock_qty}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-[#57534E] tabular-nums">
                            {item.low_stock_threshold}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold">
                            {out ? (
                              <span className="text-rose-700">Out of Stock</span>
                            ) : low ? (
                              <span className="text-amber-700">Low Stock</span>
                            ) : (
                              <span className="text-emerald-700">Healthy</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setRestockTarget(item);
                                setRestockQty('20');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                            >
                              Restock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-x-auto">
                <div className="px-5 py-4 border-b border-[#E6DEC8]">
                  <h3 className="text-sm font-bold text-[#0B132B]">
                    Inventory Transaction History
                  </h3>
                </div>
                <table className="w-full text-left border-collapse min-w-[680px]">
                  <thead>
                    <tr className="border-b border-[#E6DEC8] bg-[#FAF6EE] text-xs font-bold text-[#0B132B]">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Prev</th>
                      <th className="py-3 px-4 text-right">Delta</th>
                      <th className="py-3 px-4 text-right">New</th>
                      <th className="py-3 px-4">Reference / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-xs">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#FAF6EE]/60">
                        <td className="py-2.5 px-4 font-mono text-[#57534E] whitespace-nowrap">
                          {formatDateTime(tx.created_at)}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[#0B132B]">
                          {tx.item_name}
                        </td>
                        <td className="py-2.5 px-4 text-[#57534E]">{tx.type}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {tx.previous_qty}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums ${
                            tx.change_qty >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {tx.change_qty >= 0 ? `+${tx.change_qty}` : tx.change_qty}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                          {tx.new_qty}
                        </td>
                        <td className="py-2.5 px-4 text-[#57534E]">{tx.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 5: STALL PROFILE */}
          {section === 'stall' && (
            <form
              onSubmit={handleSaveStall}
              className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6 max-w-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#F2EAE0]">
                <div>
                  <h3 className="text-base font-bold text-[#0B132B]">Stall Configuration</h3>
                  <p className="text-xs text-[#57534E] mt-0.5">
                    Rename this demo stall or adjust timings — changes reflect immediately in student discovery.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stallForm.isOpen}
                    onChange={(e) => setStallForm({ ...stallForm, isOpen: e.target.checked })}
                    className="rounded border-[#E6DEC8] text-[#EA580C]"
                  />
                  <span>{stallForm.isOpen ? 'Counter Open' : 'Counter Closed'}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1.5">Stall Name</label>
                  <input
                    type="text"
                    required
                    value={stallForm.name}
                    onChange={(e) => setStallForm({ ...stallForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1.5">Cuisine Focus</label>
                  <input
                    type="text"
                    required
                    value={stallForm.cuisineType}
                    onChange={(e) => setStallForm({ ...stallForm, cuisineType: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B132B] mb-1.5">Description</label>
                <textarea
                  rows={3}
                  required
                  value={stallForm.description}
                  onChange={(e) => setStallForm({ ...stallForm, description: e.target.value })}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1.5">Location</label>
                  <input
                    type="text"
                    required
                    value={stallForm.location}
                    onChange={(e) => setStallForm({ ...stallForm, location: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1.5">Opening Hours</label>
                  <input
                    type="text"
                    required
                    value={stallForm.openingHours}
                    onChange={(e) => setStallForm({ ...stallForm, openingHours: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1.5">Avg Prep (mins)</label>
                  <input
                    type="number"
                    min={2}
                    max={90}
                    required
                    value={stallForm.avgPrepMinutes}
                    onChange={(e) =>
                      setStallForm({ ...stallForm, avgPrepMinutes: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
              >
                Save Stall Details
              </button>
            </form>
          )}

          {/* SECTION 6: NOTIFICATIONS */}
          {section === 'notifications' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
                    loadVendorData();
                  }}
                  className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
                >
                  Mark all as read
                </button>
              </div>
              <div className="divide-y divide-[#F2EAE0] rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden">
                {notifications.length === 0 ? (
                  <p className="p-10 text-center text-sm text-[#57534E]">No alerts yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 flex items-start justify-between gap-4 ${
                        n.is_read ? '' : 'bg-orange-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-bold text-[#0B132B]">{n.title}</div>
                          <p className="text-xs text-[#57534E] mt-0.5">{n.message}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-[#57534E] whitespace-nowrap">
                        {formatDateTime(n.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit Menu Item Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B132B]/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 bg-[#0B132B] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingItem ? `Edit ${editingItem.name}` : 'Add New Menu Item'}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveMenuItem} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1">Dish Name</label>
                  <input
                    type="text"
                    required
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B132B] mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1">Prep (min)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemForm.prepMinutes}
                    onChange={(e) => setItemForm({ ...itemForm, prepMinutes: e.target.value })}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                  />
                </div>
                {!editingItem && (
                  <div>
                    <label className="block text-xs font-bold text-[#0B132B] mb-1">Initial Stock</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={itemForm.stockQty}
                      onChange={(e) => setItemForm({ ...itemForm, stockQty: e.target.value })}
                      className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1">Alert At</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemForm.lowStockThreshold}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, lowStockThreshold: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#0B132B]">Dish Photography</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-16 rounded-xl overflow-hidden border border-[#E6DEC8] shrink-0">
                    <FoodImage src={itemForm.imageUrl} alt={itemForm.name || 'Dish preview'} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-xs font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Uploading...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <select
                      value={itemForm.imageUrl}
                      onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                      className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF6EE] px-2.5 py-1.5 text-xs"
                    >
                      {PRESET_FOOD_GALLERY.map((g) => (
                        <option key={g.url} value={g.url}>
                          Gallery: {g.label}
                        </option>
                      ))}
                      {!PRESET_FOOD_GALLERY.some((g) => g.url === itemForm.imageUrl) && (
                        <option value={itemForm.imageUrl}>Uploaded Image</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1 text-xs font-semibold text-[#0B132B]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.isVeg}
                    onChange={(e) => setItemForm({ ...itemForm, isVeg: e.target.checked })}
                  />
                  <span>Vegetarian</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.isBestseller}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, isBestseller: e.target.checked })
                    }
                  />
                  <span>Bestseller</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.isAvailable}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, isAvailable: e.target.checked })
                    }
                  />
                  <span>Available Now</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F2EAE0] hover:bg-[#E6DEC8] text-xs font-semibold text-[#0B132B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Create Menu Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B132B]/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#0B132B]">
              Restock {restockTarget.name}
            </h3>
            <p className="text-xs text-[#57534E] mt-1 font-mono tabular-nums">
              Current Stock: {restockTarget.stock_qty} units
            </p>
            <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0B132B] mb-1">Add Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0B132B] mb-1">Audit Note</label>
                <input
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
