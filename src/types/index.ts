export type UserRole = 'student' | 'vendor' | 'admin';

export type OrderStatus =
  | 'Placed'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  campusId: string;
  phone: string;
  isActive: boolean;
  stall?: {
    id: string;
    name: string;
    isOpen: boolean;
    isActive: boolean;
  } | null;
}

export interface FoodStall {
  id: string;
  vendor_id: string;
  name: string;
  slug: string;
  description: string;
  cuisine_type: string;
  location: string;
  opening_hours: string;
  avg_prep_minutes: number;
  rating: number;
  image_url: string;
  is_open: number;
  is_active: number;
  vendor_name?: string;
  available_items_count?: number;
  total_items_count?: number;
}

export interface MenuItem {
  id: string;
  stall_id: string;
  stall_name?: string;
  stall_location?: string;
  stall_is_open?: number;
  stall_prep_minutes?: number;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  is_veg: number;
  is_bestseller: number;
  prep_minutes: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_available: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_code: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  student_campus_id?: string;
  student_phone?: string;
  stall_id: string;
  stall_name?: string;
  stall_location?: string;
  subtotal: number;
  tax_amount: number;
  platform_fee: number;
  total_amount: number;
  status: OrderStatus;
  pickup_time: string;
  special_instructions: string;
  cancellation_reason: string;
  inventory_deducted: number;
  inventory_restored: number;
  payment_method?: string;
  payment_status?: string;
  payment_ref?: string;
  is_simulated?: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface InventoryTransaction {
  id: string;
  menu_item_id: string;
  item_name?: string;
  stall_id: string;
  stall_name?: string;
  type: 'order_deduction' | 'restock' | 'cancellation_restore' | 'rejection_restore' | 'manual_adjustment';
  previous_qty: number;
  change_qty: number;
  new_qty: number;
  reference_id: string;
  note: string;
  actor_name?: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  role_target: string;
  type: 'order_update' | 'new_order' | 'low_stock' | 'system';
  title: string;
  message: string;
  reference_id: string;
  is_read: number;
  created_at: string;
}

export interface PlatformSettings {
  id: number;
  campus_name: string;
  tax_rate_percent: number;
  platform_fee_flat: number;
  allow_ordering: number;
  cancellable_statuses: string;
  default_low_stock_threshold: number;
  updated_at: string;
}
