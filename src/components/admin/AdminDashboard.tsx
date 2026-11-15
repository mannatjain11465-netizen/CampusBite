import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Download,
  LogOut,
  Menu as MenuIcon,
  Package,
  Plus,
  RefreshCw,
  Settings,
  Store,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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
import { apiRequest, getStoredToken } from '../../lib/api';
import { PRESET_FOOD_GALLERY } from '../../lib/foodAssets';
import { formatCurrency, formatDateTime } from '../../lib/format';
import {
  FoodStall,
  InventoryTransaction,
  MenuItem,
  Order,
  PlatformSettings,
} from '../../types';
import { KpiSkeleton, TableRowSkeleton } from '../common/Skeletons';
import { OrderStatusLabel } from '../common/StatusBadge';

type AdminSection = 'overview' | 'orders' | 'stalls' | 'users' | 'inventory' | 'settings';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'vendor' | 'admin';
  campus_id: string;
  phone: string;
  is_active: number;
  created_at: string;
  stall_id?: string | null;
  stall_name?: string | null;
}

interface AdminAnalytics {
  kpis: {
    totalOrders: number;
    totalRevenue: number;
    activeOrders: number;
    activeStudents: number;
    activeVendors: number;
    activeStalls: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  revenueByStall: { id: string; name: string; orders: number; revenue: number }[];
  dailyRevenue: { date: string; orders: number; revenue: number }[];
  ordersByStatus: { status: string; count: number }[];
}

export function AdminDashboard({ onBackToLanding }: { onBackToLanding: () => void }) {
  const { user, logout } = useAuth();
  const { showToast, confirmAction } = useToast();

  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stalls, setStalls] = useState<FoodStall[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<MenuItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<MenuItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'vendor' | 'admin'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');

  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    email: '',
    password: '',
    campusId: '',
    phone: '',
  });

  const [stallModalOpen, setStallModalOpen] = useState(false);
  const [stallForm, setStallForm] = useState({
    vendorId: '',
    name: '',
    description: '',
    cuisineType: '',
    location: '',
    openingHours: '08:30 AM - 10:00 PM',
    avgPrepMinutes: '12',
    imageUrl: PRESET_FOOD_GALLERY[0].url,
  });

  const [settingsForm, setSettingsForm] = useState({
    campusName: '',
    taxRatePercent: '5',
    platformFeeFlat: '5',
    allowOrdering: true,
    cancellableStatuses: 'Placed,Accepted',
    defaultLowStockThreshold: '10',
  });

  const loadAdminData = useCallback(async () => {
    try {
      const [anRes, ordRes, stallRes, usrRes, invRes, setRes] = await Promise.all([
        apiRequest<AdminAnalytics>('/api/admin/analytics'),
        apiRequest<{ orders: Order[] }>('/api/orders/all'),
        apiRequest<{ stalls: FoodStall[] }>('/api/stalls?includeInactive=true'),
        apiRequest<{ users: AdminUserRow[] }>('/api/admin/users'),
        apiRequest<{
          items: MenuItem[];
          lowStockItems: MenuItem[];
          transactions: InventoryTransaction[];
        }>('/api/inventory/admin'),
        apiRequest<{ settings: PlatformSettings }>('/api/admin/settings'),
      ]);

      setAnalytics(anRes);
      setOrders(ordRes.orders);
      setStalls(stallRes.stalls);
      setUsers(usrRes.users);
      setInventoryItems(invRes.items);
      setLowStockItems(invRes.lowStockItems);
      setTransactions(invRes.transactions);
      setSettings(setRes.settings);
      if (setRes.settings) {
        setSettingsForm({
          campusName: setRes.settings.campus_name,
          taxRatePercent: String(setRes.settings.tax_rate_percent),
          platformFeeFlat: String(setRes.settings.platform_fee_flat),
          allowOrdering: Boolean(setRes.settings.allow_ordering),
          cancellableStatuses: setRes.settings.cancellable_statuses,
          defaultLowStockThreshold: String(setRes.settings.default_low_stock_threshold),
        });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load admin console', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleToggleUserStatus = async (target: AdminUserRow) => {
    const nextActive = !target.is_active;
    const ok = await confirmAction({
      title: `${nextActive ? 'Activate' : 'Suspend'} ${target.name}?`,
      message: nextActive
        ? `Restores platform access for ${target.email}.`
        : `Immediately blocks ${target.email} from signing in or placing/managing orders.`,
      confirmLabel: nextActive ? 'Activate Account' : 'Suspend Account',
      destructive: !nextActive,
    });
    if (!ok) return;

    try {
      await apiRequest(`/api/admin/users/${target.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      showToast(`Account ${nextActive ? 'activated' : 'suspended'}`, 'success');
      await loadAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update user', 'error');
    }
  };

  const handleToggleStallActive = async (stall: FoodStall) => {
    const nextActive = !stall.is_active;
    try {
      await apiRequest(`/api/stalls/${stall.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      showToast(`${stall.name} ${nextActive ? 'activated' : 'deactivated'}`, 'success');
      await loadAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle stall', 'error');
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/vendors', {
        method: 'POST',
        body: JSON.stringify(vendorForm),
      });
      showToast(`Vendor account created for ${vendorForm.name}`, 'success');
      setVendorModalOpen(false);
      setVendorForm({ name: '', email: '', password: '', campusId: '', phone: '' });
      await loadAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create vendor', 'error');
    }
  };

  const handleCreateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/stalls', {
        method: 'POST',
        body: JSON.stringify({
          ...stallForm,
          avgPrepMinutes: Number(stallForm.avgPrepMinutes),
        }),
      });
      showToast(`Created food stall ${stallForm.name}`, 'success');
      setStallModalOpen(false);
      await loadAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create stall', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          campusName: settingsForm.campusName,
          taxRatePercent: Number(settingsForm.taxRatePercent),
          platformFeeFlat: Number(settingsForm.platformFeeFlat),
          allowOrdering: settingsForm.allowOrdering,
          cancellableStatuses: settingsForm.cancellableStatuses,
          defaultLowStockThreshold: Number(settingsForm.defaultLowStockThreshold),
        }),
      });
      showToast('Platform settings saved', 'success');
      await loadAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
    }
  };

  const handleDownloadCsv = async (type: 'orders' | 'inventory') => {
    try {
      const token = getStoredToken();
      const res = await fetch(`/api/admin/reports/export?type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Report generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campusbite-${type}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${type} CSV report`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'CSV export failed', 'error');
    }
  };

  const navItems: {
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', label: 'Platform Overview', icon: BarChart3 },
    { id: 'orders', label: 'All Orders Monitor', icon: ClipboardList },
    { id: 'stalls', label: 'Food Stalls', icon: Store },
    { id: 'users', label: 'Students & Vendors', icon: Users },
    { id: 'inventory', label: 'Global Inventory', icon: Package },
    { id: 'settings', label: 'Reports & Settings', icon: Settings },
  ];

  const filteredUsers =
    roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter);

  const filteredOrders =
    orderStatusFilter === 'All'
      ? orders
      : orders.filter((o) => o.status === orderStatusFilter);

  const vendorsList = users.filter((u) => u.role === 'vendor');

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#1C1917] flex">
      {/* Midnight Navy Enterprise Sidebar */}
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
            className="lg:hidden p-1.5 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-[11px] font-bold tracking-wider text-[#FBBF24]">
            IIIT ALLAHABAD · ADMINISTRATION
          </p>
          <p className="text-sm font-bold text-white truncate mt-1">
            {settings?.campus_name || 'IIIT Allahabad Campus Food Court'}
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
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#F97316] text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
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
              <span>Admin Console</span>
              <span className="mx-2">/</span>
              <span className="font-bold text-[#0B132B]">
                {navItems.find((n) => n.id === section)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleDownloadCsv('orders')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Orders CSV</span>
            </button>
            <button
              type="button"
              onClick={() => loadAdminData()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-8">
          {/* SECTION 1: PLATFORM OVERVIEW */}
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
                      <p className="text-xs font-medium text-slate-300">Platform Gross Revenue</p>
                      <p className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">
                        {formatCurrency(analytics.kpis.totalRevenue)}
                      </p>
                      <p className="mt-1 text-xs text-[#FBBF24] font-mono tabular-nums">
                        {analytics.kpis.totalOrders} total orders
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <p className="text-xs font-medium text-[#57534E]">Active Stalls & Vendors</p>
                      <p className="mt-2 text-2xl font-bold text-[#0B132B] font-mono tabular-nums">
                        {analytics.kpis.activeStalls} Stalls
                      </p>
                      <p className="mt-1 text-xs text-[#57534E] font-mono tabular-nums">
                        {analytics.kpis.activeStudents} active students
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <p className="text-xs font-medium text-[#57534E]">Orders In Progress</p>
                      <p className="mt-2 text-2xl font-bold text-[#EA580C] font-mono tabular-nums">
                        {analytics.kpis.activeOrders}
                      </p>
                      <p className="mt-1 text-xs text-[#57534E]">Across all counters</p>
                    </div>
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <p className="text-xs font-medium text-[#57534E]">Inventory Alerts</p>
                      <p className="mt-2 text-2xl font-bold text-amber-700 font-mono tabular-nums">
                        {analytics.kpis.lowStockCount} Low
                      </p>
                      <p className="mt-1 text-xs text-[#57534E] font-mono tabular-nums">
                        {analytics.kpis.outOfStockCount} out of stock
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5">
                      <h3 className="text-sm font-bold text-[#0B132B] mb-4">
                        Revenue by Food Stall (₹)
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.revenueByStall}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6DEC8" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#57534E' }} />
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
                        Daily Revenue Trend (₹)
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.dailyRevenue}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6DEC8" />
                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#57534E' }} />
                            <YAxis tick={{ fontSize: 12, fill: '#57534E' }} />
                            <Tooltip
                              formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              stroke="#0B132B"
                              fill="#F97316"
                              fillOpacity={0.18}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* SECTION 2: ALL ORDERS MONITOR */}
          {section === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F2EAE0] rounded-xl w-fit">
                {['All', 'Placed', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Rejected', 'Cancelled'].map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderStatusFilter(st)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                        orderStatusFilter === st
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
                      <th className="py-3.5 px-4">Order Code</th>
                      <th className="py-3.5 px-4">Stall</th>
                      <th className="py-3.5 px-4">Student</th>
                      <th className="py-3.5 px-4">Payment</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-sm">
                    {loading ? (
                      <TableRowSkeleton cols={6} />
                    ) : (
                      filteredOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FAF6EE]/60">
                          <td className="py-3 px-4 font-mono text-xs font-bold text-[#0B132B]">
                            {o.order_code}
                            <div className="font-sans font-normal text-[11px] text-[#57534E]">
                              {formatDateTime(o.created_at)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-[#0B132B]">
                            {o.stall_name}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="font-semibold text-[#0B132B]">{o.student_name}</div>
                            <div className="text-[#57534E] font-mono">{o.student_campus_id}</div>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#57534E]">
                            <div>{o.payment_method}</div>
                            <div className="font-semibold text-[#0B132B]">{o.payment_status}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs tabular-nums text-[#0B132B]">
                            {formatCurrency(o.total_amount)}
                          </td>
                          <td className="py-3 px-4">
                            <OrderStatusLabel status={o.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: FOOD STALLS */}
          {section === 'stalls' && (
            <div className="space-y-4">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (vendorsList[0]) {
                      setStallForm((f) => ({ ...f, vendorId: vendorsList[0].id }));
                    }
                    setStallModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Food Stall</span>
                </button>
              </div>

              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[#E6DEC8] bg-[#FAF6EE] text-xs font-bold text-[#0B132B]">
                      <th className="py-3.5 px-4">Stall Name</th>
                      <th className="py-3.5 px-4">Vendor Owner</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4 text-right">Menu Items</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-sm">
                    {stalls.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FAF6EE]/60">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#0B132B]">{s.name}</div>
                          <div className="text-xs text-[#57534E]">{s.cuisine_type}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#0B132B]">{s.vendor_name}</td>
                        <td className="py-3.5 px-4 text-xs text-[#57534E]">{s.location}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums">
                          {s.available_items_count ?? 0} / {s.total_items_count ?? 0}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold">
                          {s.is_active ? (
                            <span className="text-emerald-700">Active</span>
                          ) : (
                            <span className="text-rose-700">Deactivated</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleStallActive(s)}
                            className="px-3 py-1.5 rounded-lg border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer"
                          >
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 4: USERS & VENDORS */}
          {section === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1 p-1.5 bg-[#F2EAE0] rounded-xl">
                  {(['all', 'student', 'vendor', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleFilter(r)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize cursor-pointer ${
                        roleFilter === r ? 'bg-[#0B132B] text-white shadow-xs' : 'text-[#57534E]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setVendorModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Vendor Account</span>
                </button>
              </div>

              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#E6DEC8] bg-[#FAF6EE] text-xs font-bold text-[#0B132B]">
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Campus ID</th>
                      <th className="py-3.5 px-4">Assigned Stall</th>
                      <th className="py-3.5 px-4">Account Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-sm">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[#FAF6EE]/60">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#0B132B]">{u.name}</div>
                          <div className="text-xs text-[#57534E]">{u.email}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold capitalize">{u.role}</td>
                        <td className="py-3 px-4 font-mono text-xs">{u.campus_id || '—'}</td>
                        <td className="py-3 px-4 text-xs text-[#57534E]">
                          {u.stall_name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold">
                          {u.is_active ? (
                            <span className="text-emerald-700">Active</span>
                          ) : (
                            <span className="text-rose-700">Suspended</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {u.id !== user?.id && (
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u)}
                              className="px-3 py-1.5 rounded-lg border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer"
                            >
                              {u.is_active ? 'Suspend' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 5: GLOBAL INVENTORY */}
          {section === 'inventory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#57534E]">
                  {lowStockItems.length} item(s) across all campus stalls are currently below their alert threshold.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('inventory')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E6DEC8] bg-[#FFFDF9] hover:bg-[#F2EAE0] text-xs font-semibold text-[#0B132B] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Inventory CSV</span>
                </button>
              </div>

              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#E6DEC8] bg-[#FAF6EE] text-xs font-bold text-[#0B132B]">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Food Stall</th>
                      <th className="py-3 px-4 text-right">Price</th>
                      <th className="py-3 px-4 text-right">Stock</th>
                      <th className="py-3 px-4 text-right">Threshold</th>
                      <th className="py-3 px-4">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-sm">
                    {inventoryItems.map((it) => {
                      const out = it.stock_qty === 0;
                      const low = !out && it.stock_qty <= it.low_stock_threshold;
                      return (
                        <tr key={it.id} className="hover:bg-[#FAF6EE]/60">
                          <td className="py-3 px-4 font-semibold text-[#0B132B]">{it.name}</td>
                          <td className="py-3 px-4 text-xs text-[#57534E]">{it.stall_name}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                            {formatCurrency(it.price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                            {it.stock_qty}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-[#57534E] tabular-nums">
                            {it.low_stock_threshold}
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-x-auto">
                <div className="px-5 py-4 border-b border-[#E6DEC8]">
                  <h3 className="text-sm font-bold text-[#0B132B]">
                    Recent Global Inventory Ledger
                  </h3>
                </div>
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#E6DEC8] bg-[#FAF6EE] text-xs font-bold text-[#0B132B]">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Stall</th>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4 text-right">Delta</th>
                      <th className="py-3 px-4 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EAE0] text-xs">
                    {transactions.slice(0, 20).map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2.5 px-4 font-mono text-[#57534E]">
                          {formatDateTime(tx.created_at)}
                        </td>
                        <td className="py-2.5 px-4">{tx.stall_name}</td>
                        <td className="py-2.5 px-4 font-semibold text-[#0B132B]">{tx.item_name}</td>
                        <td className="py-2.5 px-4 text-[#57534E]">{tx.type}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 6: REPORTS & PLATFORM SETTINGS */}
          {section === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <form
                onSubmit={handleSaveSettings}
                className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6 space-y-4"
              >
                <h3 className="text-base font-bold text-[#0B132B]">Platform-Level Configuration</h3>
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1">
                    Campus Food Court Name
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.campusName}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, campusName: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0B132B] mb-1">GST Rate (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={30}
                      value={settingsForm.taxRatePercent}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, taxRatePercent: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B132B] mb-1">Platform Fee (₹)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={settingsForm.platformFeeFlat}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, platformFeeFlat: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B132B] mb-1">Default Low-Stock</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={settingsForm.defaultLowStockThreshold}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          defaultLowStockThreshold: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1">
                    Student Cancellable Statuses (CSV)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.cancellableStatuses}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, cancellableStatuses: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B132B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.allowOrdering}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, allowOrdering: e.target.checked })
                    }
                  />
                  <span>Allow Students to Place New Orders</span>
                </label>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
                  >
                    Save Platform Settings
                  </button>
                </div>
              </form>

              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6 space-y-4 h-fit">
                <h3 className="text-base font-bold text-[#0B132B]">Audit & Compliance Reports</h3>
                <p className="text-sm text-[#57534E]">
                  Generate real-time CSV snapshots for IIIT Allahabad food court reconciliation and stock audits.
                </p>
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv('orders')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-sm font-semibold text-[#0B132B] cursor-pointer"
                  >
                    <span>Orders & Simulated Payment Ledger (CSV)</span>
                    <Download className="w-4 h-4 text-[#EA580C]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv('inventory')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-[#F2EAE0] text-sm font-semibold text-[#0B132B] cursor-pointer"
                  >
                    <span>All-Stalls Inventory & Stock Thresholds (CSV)</span>
                    <Download className="w-4 h-4 text-[#EA580C]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Vendor Modal */}
      {vendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B132B]/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#0B132B] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">Create Vendor Account</h3>
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="p-1 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateVendor} className="p-6 space-y-3.5">
              <input
                type="text"
                required
                placeholder="Vendor Owner Name"
                value={vendorForm.name}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              />
              <input
                type="email"
                required
                placeholder="Vendor Email"
                value={vendorForm.email}
                onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Initial Password"
                value={vendorForm.password}
                onChange={(e) => setVendorForm({ ...vendorForm, password: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Staff ID (DEMO-VND-05)"
                  value={vendorForm.campusId}
                  onChange={(e) => setVendorForm({ ...vendorForm, campusId: e.target.value })}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone"
                  value={vendorForm.phone}
                  onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
              >
                Create Vendor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Stall Modal */}
      {stallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B132B]/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#0B132B] text-white flex items-center justify-between">
              <h3 className="text-base font-bold">Register New Food Stall</h3>
              <button
                type="button"
                onClick={() => setStallModalOpen(false)}
                className="p-1 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateStall} className="p-6 space-y-3.5">
              <select
                required
                value={stallForm.vendorId}
                onChange={(e) => setStallForm({ ...stallForm, vendorId: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              >
                <option value="">Select Vendor Owner</option>
                {vendorsList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.email})
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Stall Name"
                value={stallForm.name}
                onChange={(e) => setStallForm({ ...stallForm, name: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Cuisine Type (e.g. North Indian & Chaat)"
                value={stallForm.cuisineType}
                onChange={(e) => setStallForm({ ...stallForm, cuisineType: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Location (e.g. Demo Bay 05, Prayagraj)"
                value={stallForm.location}
                onChange={(e) => setStallForm({ ...stallForm, location: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              />
              <textarea
                rows={2}
                required
                placeholder="Short description"
                value={stallForm.description}
                onChange={(e) => setStallForm({ ...stallForm, description: e.target.value })}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
              >
                Create Food Stall
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
