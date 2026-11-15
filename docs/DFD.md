# Data Flow Diagrams (DFD) — CampusBite

## 1. Level 0 — Context Diagram

```mermaid
flowchart LR
    STU([Student]) -- "Browse Menu, Cart Checkout, Cancel Order" --> SYS((0.0 CampusBite System))
    SYS -- "Menu Availability, Order Confirmation, Live Status" --> STU

    VND([Food Vendor]) -- "Menu CRUD, Stock Restock, Order Status Updates" --> SYS
    SYS -- "Incoming Orders, Low-Stock Alerts, Sales Analytics" --> VND

    ADM([Campus Admin]) -- "User/Stall Governance, Platform Policies" --> SYS
    SYS -- "Platform KPIs, Global Inventory, CSV Reports" --> ADM
```

---

## 2. Level 1 — System Data Flow Diagram

```mermaid
flowchart TB
    STU([Student])
    VND([Vendor])
    ADM([Admin])

    P1((1.0 Auth & RBAC))
    P2((2.0 Menu & Stall Discovery))
    P3((3.0 Order & Simulated Payment))
    P4((4.0 Inventory Control & Alerts))
    P5((5.0 Analytics & Admin Reports))

    D1[(D1: Users)]
    D2[(D2: Food Stalls & Menu Items)]
    D3[(D3: Orders, Items & Payments)]
    D4[(D4: Inventory Transactions)]
    D5[(D5: Notifications & Settings)]

    STU & VND & ADM --> P1 --> D1
    STU --> P2 --> D2
    VND -- "Manage Items/Images" --> P2
    STU -- "Checkout / Cancel" --> P3
    P3 <--> D3
    P3 -- "Atomic Deduct / Restore" --> P4
    VND -- "Restock / Adjust" --> P4
    P4 <--> D2
    P4 --> D4
    P4 -- "Low Stock Event" --> D5
    VND & ADM --> P5
    D3 & D2 & D1 --> P5
```

---

## 3. Level 2 — Atomic Order & Inventory Process (Process 3.0 & 4.0)

1. **Validate Request:** Verify student JWT, `platform_settings.allow_ordering`, and `idempotency_key`.
2. **Acquire Write Lock (`BEGIN IMMEDIATE`):** Lock SQLite write transaction.
3. **Verify & Deduct Stock:** Check `stall.is_active`, `stall.is_open`, `menu_item.is_available`, and execute conditional `stock_qty - qty WHERE stock_qty >= qty`. Roll back immediately on failure.
4. **Persist Order & Simulated Payment:** Insert `orders` (`inventory_deducted = 1`), `order_items`, and `payments` (`Paid (Simulated)`).
5. **Append Audit Ledger & Alerts:** Insert `inventory_transactions` (`order_deduction`), emit `new_order` notification, and emit `low_stock` notification if `new_qty <= low_stock_threshold`.
6. **Commit Transaction:** Return confirmed order(s) to student UI.
