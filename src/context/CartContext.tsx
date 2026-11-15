import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MenuItem } from '../types';
import { useToast } from './ToastContext';

export interface CartEntry {
  item: MenuItem;
  quantity: number;
}

interface CartContextValue {
  entries: CartEntry[];
  totalItemsCount: number;
  subtotal: number;
  addToCart: (item: MenuItem, qty?: number) => void;
  updateQuantity: (menuItemId: string, nextQty: number) => void;
  removeFromCart: (menuItemId: string) => void;
  clearCart: () => void;
  syncItemStock: (latestItems: MenuItem[]) => void;
}

const CART_STORAGE_KEY = 'campusbite_cart_v1';
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<CartEntry[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartEntry[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore storage restriction
    }
  }, [entries]);

  const addToCart = useCallback(
    (item: MenuItem, qty = 1) => {
      if (!item.is_available || item.stock_qty <= 0) {
        showToast(`${item.name} is currently out of stock.`, 'error');
        return;
      }
      if (item.stall_is_open === 0) {
        showToast(`${item.stall_name || 'This stall'} is currently closed.`, 'error');
        return;
      }

      setEntries((prev) => {
        const existing = prev.find((e) => e.item.id === item.id);
        const currentQty = existing ? existing.quantity : 0;
        const nextQty = currentQty + qty;
        if (nextQty > item.stock_qty) {
          showToast(
            `Cannot add more. Only ${item.stock_qty} unit(s) of ${item.name} in stock.`,
            'error'
          );
          return prev;
        }
        showToast(`Added ${item.name} to cart`, 'success');
        if (existing) {
          return prev.map((e) =>
            e.item.id === item.id ? { item, quantity: nextQty } : e
          );
        }
        return [...prev, { item, quantity: qty }];
      });
    },
    [showToast]
  );

  const updateQuantity = useCallback(
    (menuItemId: string, nextQty: number) => {
      if (nextQty <= 0) {
        setEntries((prev) => prev.filter((e) => e.item.id !== menuItemId));
        return;
      }
      setEntries((prev) =>
        prev.map((e) => {
          if (e.item.id !== menuItemId) return e;
          if (nextQty > e.item.stock_qty) {
            showToast(`Only ${e.item.stock_qty} unit(s) available in stock.`, 'error');
            return { ...e, quantity: e.item.stock_qty };
          }
          return { ...e, quantity: nextQty };
        })
      );
    },
    [showToast]
  );

  const removeFromCart = useCallback((menuItemId: string) => {
    setEntries((prev) => prev.filter((e) => e.item.id !== menuItemId));
  }, []);

  const clearCart = useCallback(() => {
    setEntries([]);
  }, []);

  const syncItemStock = useCallback((latestItems: MenuItem[]) => {
    const map = new Map(latestItems.map((i) => [i.id, i]));
    setEntries((prev) =>
      prev
        .map((e) => {
          const fresh = map.get(e.item.id);
          if (!fresh) return null;
          if (!fresh.is_available || fresh.stock_qty <= 0) return null;
          return {
            item: fresh,
            quantity: Math.min(e.quantity, fresh.stock_qty),
          };
        })
        .filter((x): x is CartEntry => x !== null)
    );
  }, []);

  const totalItemsCount = useMemo(
    () => entries.reduce((sum, e) => sum + e.quantity, 0),
    [entries]
  );

  const subtotal = useMemo(
    () => entries.reduce((sum, e) => sum + e.item.price * e.quantity, 0),
    [entries]
  );

  return (
    <CartContext.Provider
      value={{
        entries,
        totalItemsCount,
        subtotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        syncItemStock,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
