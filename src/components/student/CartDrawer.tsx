import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { Order, PlatformSettings } from '../../types';
import { FoodImage } from '../common/FoodImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PlatformSettings | null;
  onOrderPlaced: (orders: Order[]) => void;
  onRequireLogin: () => void;
}

const PICKUP_SLOTS = [
  'ASAP (15 mins)',
  '12:30 PM',
  '01:15 PM',
  '04:00 PM',
  '06:30 PM',
  '08:00 PM',
];

const PAYMENT_METHODS = [
  { id: 'UPI (Simulated)', label: 'UPI (Simulated)', hint: 'Instant GPay / PhonePe demo flow' },
  { id: 'Campus Wallet (Simulated)', label: 'Campus Wallet (Simulated)', hint: 'IIITA Demo Meal Wallet' },
  { id: 'Card (Simulated)', label: 'Card (Simulated)', hint: 'Debit / Credit demo card' },
] as const;

export function CartDrawer({
  isOpen,
  onClose,
  settings,
  onOrderPlaced,
  onRequireLogin,
}: CartDrawerProps) {
  const { user } = useAuth();
  const { entries, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const { showToast } = useToast();

  const [pickupTime, setPickupTime] = useState(PICKUP_SLOTS[0]);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]['id']>(
    'UPI (Simulated)'
  );
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState<Order[] | null>(null);

  const groupedByStall = useMemo(() => {
    const map = new Map<string, { stallName: string; items: typeof entries }>();
    for (const entry of entries) {
      const sid = entry.item.stall_id;
      const existing = map.get(sid);
      if (existing) {
        existing.items.push(entry);
      } else {
        map.set(sid, {
          stallName: entry.item.stall_name || 'Demo Campus Stall',
          items: [entry],
        });
      }
    }
    return Array.from(map.entries());
  }, [entries]);

  const taxRate = settings?.tax_rate_percent ?? 5;
  const feePerOrder = settings?.platform_fee_flat ?? 5;
  const stallCount = Math.max(groupedByStall.length, 0);
  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
  const platformFee = entries.length > 0 ? Number((feePerOrder * stallCount).toFixed(2)) : 0;
  const grandTotal = Number((subtotal + taxAmount + platformFee).toFixed(2));

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (!user) {
      onClose();
      onRequireLogin();
      return;
    }
    if (user.role !== 'student') {
      showToast('Please sign in with a Student account to place food orders.', 'error');
      return;
    }
    if (entries.length === 0) return;

    setSubmitting(true);
    try {
      const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res = await apiRequest<{ orders: Order[] }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: entries.map((e) => ({
            menuItemId: e.item.id,
            quantity: e.quantity,
          })),
          pickupTime,
          paymentMethod,
          specialInstructions,
          idempotencyKey,
        }),
      });

      clearCart();
      setSpecialInstructions('');
      setConfirmedOrders(res.orders);
      showToast(
        res.orders.length > 1
          ? `${res.orders.length} stall orders confirmed!`
          : `Order ${res.orders[0]?.order_code} confirmed!`,
        'success'
      );
      onOrderPlaced(res.orders);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Checkout failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setConfirmedOrders(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0B132B]/65 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md bg-[#FAF6EE] h-full flex flex-col border-l border-[#E6DEC8] shadow-2xl"
      >
        {/* Midnight Navy Header */}
        <div className="px-6 py-4 bg-[#0B132B] text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/15 border border-[#F97316]/35 flex items-center justify-center text-[#FBBF24]">
              {confirmedOrders ? (
                <Receipt className="w-4.5 h-4.5" />
              ) : (
                <ShoppingBag className="w-4.5 h-4.5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {confirmedOrders ? 'Order Confirmed' : 'Your Meal Cart'}
              </h2>
              <p className="text-[11px] text-[#FBBF24]">
                IIIT Allahabad Campus Food Court
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close cart"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {confirmedOrders ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Order placed & stock reserved
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Simulated payment succeeded and stall inventory has been atomically deducted.
                  </p>
                </div>
              </div>

              {confirmedOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-[#E6DEC8] bg-[#FFFDF9] p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-[#0B132B]">
                      {ord.order_code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[11px] font-bold text-[#EA580C]">
                      {ord.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#57534E]">
                    <span className="font-semibold text-[#0B132B]">{ord.stall_name}</span> · Pickup:{' '}
                    <span className="font-semibold text-[#0B132B]">{ord.pickup_time}</span>
                  </div>
                  <div className="border-t border-[#F2EAE0] pt-2.5 space-y-1.5">
                    {ord.items.map((it) => (
                      <div key={it.id} className="flex justify-between text-xs">
                        <span className="text-[#1C1917]">
                          {it.quantity}x {it.item_name}
                        </span>
                        <span className="font-mono tabular-nums text-[#57534E]">
                          {formatCurrency(it.line_total)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#F2EAE0] pt-2.5 flex items-center justify-between text-xs">
                    <span className="text-[#57534E]">
                      {ord.payment_method} · Ref: <span className="font-mono">{ord.payment_ref}</span>
                    </span>
                    <span className="font-mono font-bold text-sm text-[#0B132B] tabular-nums">
                      {formatCurrency(ord.total_amount)}
                    </span>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 rounded-xl bg-[#0B132B] hover:bg-[#111C3A] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Track Live Order Status
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-[#0B132B] text-[#FBBF24] flex items-center justify-center mb-4">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-[#0B132B]">Your meal cart is empty</h3>
              <p className="mt-1.5 text-sm text-[#57534E] max-w-xs leading-relaxed">
                Browse IIIT Allahabad demo counters and add samosas, dosas, momos, or cold coffee to build your order.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByStall.map(([stallId, group]) => (
                <div
                  key={stallId}
                  className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-4 space-y-3.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#F2EAE0]">
                    <span className="text-xs font-bold text-[#0B132B]">{group.stallName}</span>
                    <span className="text-[11px] font-mono text-[#57534E]">
                      {group.items.length} item(s)
                    </span>
                  </div>
                  {group.items.map(({ item, quantity }) => (
                    <div key={item.id} className="flex gap-3.5 items-center">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F2EAE0] shrink-0 border border-[#E6DEC8]">
                        <FoodImage src={item.image_url} alt={item.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-[#0B132B] truncate">
                          {item.name}
                        </h4>
                        <p className="text-xs text-[#57534E] font-mono tabular-nums mt-0.5">
                          {formatCurrency(item.price)} · {item.stock_qty} left
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="inline-flex items-center border border-[#E6DEC8] rounded-lg bg-[#FAF6EE]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, quantity - 1)}
                              aria-label={`Decrease quantity of ${item.name}`}
                              className="p-1.5 text-[#0B132B] hover:bg-[#F2EAE0] rounded-l-lg cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 text-xs font-mono font-bold text-[#0B132B] tabular-nums">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, quantity + 1)}
                              aria-label={`Increase quantity of ${item.name}`}
                              className="p-1.5 text-[#0B132B] hover:bg-[#F2EAE0] rounded-r-lg cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="p-1.5 text-[#57534E] hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-[#0B132B] font-mono tabular-nums">
                        {formatCurrency(item.price * quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Pickup Time */}
              <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-4 space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#0B132B] mb-2.5">
                    <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Pickup Time Slot</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PICKUP_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setPickupTime(slot)}
                        className={`px-3 py-2 text-xs rounded-xl border text-left transition-colors cursor-pointer ${
                          pickupTime === slot
                            ? 'border-[#0B132B] bg-[#0B132B] text-white font-semibold'
                            : 'border-[#E6DEC8] bg-[#FAF6EE] text-[#57534E] hover:border-[#D4A017]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulated Payment Method */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#0B132B] mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>Payment Method (Simulated for Demo)</span>
                  </label>
                  <p className="text-[11px] text-[#57534E] mb-2.5 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>No real money is charged; generates demo receipt IDs.</span>
                  </p>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((method) => {
                      const active = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[#EA580C] bg-orange-50/80 text-[#0B132B]'
                              : 'border-[#E6DEC8] bg-[#FAF6EE] text-[#57534E] hover:border-[#D4A017]'
                          }`}
                        >
                          <div className="text-xs font-bold">{method.label}</div>
                          <div className="text-[11px] text-[#57534E] mt-0.5">{method.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="block text-xs font-bold text-[#0B132B] mb-1.5">
                    Kitchen Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Less spicy, pack chutney separately"
                    maxLength={200}
                    className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF6EE] px-3 py-2 text-xs text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#EA580C]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Totals & Checkout CTA */}
        {!confirmedOrders && entries.length > 0 && (
          <div className="p-6 border-t border-[#E6DEC8] bg-[#FFFDF9] space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#57534E]">
                <span>Item Subtotal</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#57534E]">
                <span>Campus GST ({taxRate}%)</span>
                <span className="font-mono tabular-nums">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-[#57534E]">
                <span>
                  Platform Fee ({stallCount} {stallCount === 1 ? 'stall' : 'stalls'})
                </span>
                <span className="font-mono tabular-nums">{formatCurrency(platformFee)}</span>
              </div>
              <div className="pt-2.5 border-t border-[#E6DEC8] flex justify-between text-sm font-bold text-[#0B132B]">
                <span>Total Payable</span>
                <span className="font-mono tabular-nums text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleCheckout}
              className="w-full py-3.5 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {user
                  ? `Confirm & Pay ${formatCurrency(grandTotal)}`
                  : 'Sign In to Place Order'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
