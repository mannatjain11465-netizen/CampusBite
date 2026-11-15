import React from 'react';
import {
  CheckCircle2,
  ChefHat,
  Clock,
  PackageCheck,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { OrderStatus } from '../../types';

const STATUS_META: Record<
  OrderStatus,
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  Placed: { icon: Clock, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  Accepted: { icon: ThumbsUp, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
  Preparing: { icon: ChefHat, tone: 'text-[#C2410C] bg-orange-50 border-orange-200' },
  Ready: { icon: PackageCheck, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  Completed: { icon: CheckCircle2, tone: 'text-zinc-700 bg-stone-100 border-stone-200' },
  Rejected: { icon: XCircle, tone: 'text-rose-700 bg-rose-50 border-rose-200' },
  Cancelled: { icon: XCircle, tone: 'text-zinc-600 bg-stone-100 border-stone-200' },
};

export function OrderStatusLabel({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status] || STATUS_META.Placed;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap ${meta.tone}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}
