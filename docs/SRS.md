# Software Requirements Specification (SRS) — CampusBite

**Document Version:** 1.0  
**Project Name:** CampusBite — Campus Food Court Order & Inventory Management System  
**Standard:** IEEE 830-1998 Adapted for B.Tech Software Engineering Evaluation  

---

## 1. Introduction

### 1.1 Problem Statement
College campus food courts experience extreme demand spikes during 15-minute lecture breaks and lunch hours. Manual counter ordering causes long queues, frequent miscommunication of special instructions, overselling of limited-batch items (such as fresh dosas, wood-fired pizzas, or paneer wraps), and a lack of centralized visibility for campus administrators. Vendors struggle with manual stock reconciliation and discover stockouts only after accepting orders, forcing awkward refunds and student frustration.

### 1.2 Project Objectives
1. Provide a unified, mobile-responsive web portal connecting **Students**, **Food Vendors**, and **Campus Administrators**.
2. Eliminate counter queues through scheduled or ASAP pickup slots and real-time order status tracking (`Placed → Accepted → Preparing → Ready → Completed`).
3. Enforce **atomic, concurrency-safe inventory management** so items cannot be oversold or deducted twice.
4. Equip vendors with a live kitchen queue, menu/image CRUD, restock controls, low-stock alerts, and sales analytics.
5. Provide administrators with platform-wide monitoring, user/stall governance, CSV reporting, and policy configuration.

### 1.3 Scope
- **In Scope:** Student registration and JWT authentication, multi-stall food discovery, cart and simulated checkout, order lifecycle management, rule-based student cancellation with automatic stock restoration, vendor kitchen & inventory management, admin analytics and CSV exports.
- **Out of Scope:** Real payment gateway integration (simulated payments are clearly marked for academic demonstration), third-party off-campus delivery logistics.

---

## 2. User Requirements & Roles

| Role | Primary Responsibilities |
| :--- | :--- |
| **Student** | Register/login, browse active stalls, search/filter dishes, manage cart, choose pickup time, place order with simulated payment, track live status, cancel eligible orders. |
| **Food Vendor** | Sign in, manage own stall profile & open/closed status, CRUD menu items with image upload, accept/reject/prepare/complete orders, restock items, inspect low-stock alerts and sales charts. |
| **Administrator** | Sign in, monitor all orders and global inventory, manage student/vendor accounts, register/deactivate stalls, configure platform tax/fees/policies, export CSV reports. |

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization (FR-AUTH)
- **FR-AUTH-01:** Students shall register using name, unique email, password (hashed with bcrypt), campus roll ID, and phone number. Public registration shall strictly assign the `student` role.
- **FR-AUTH-02:** All three roles shall authenticate via email/password and receive a signed JWT (`HS256`, 7-day expiry).
- **FR-AUTH-03:** Protected API routes shall enforce role-based access control (RBAC) and stall ownership checks (vendors may only mutate their own stall, menu, and orders).

### 3.2 Student Ordering & Tracking (FR-STU)
- **FR-STU-01:** Students shall browse active stalls and filter menu items by keyword, stall, category, vegetarian preference, and live availability.
- **FR-STU-02:** Students shall add items to a persistent cart, adjust quantities (capped by live `stock_qty`), and view subtotal, campus GST, and platform fee totals.
- **FR-STU-03:** On checkout, the system shall support multi-stall carts by atomically generating per-stall orders inside a single database transaction with an `idempotency_key`.
- **FR-STU-04:** Students shall cancel an order **only** while its status is within configured cancellable states (`Placed` or `Accepted`). Cancellation shall restore inventory and mark the simulated payment as `Refunded (Simulated)`.

### 3.3 Inventory Management (FR-INV)
- **FR-INV-01:** Every menu item shall maintain `stock_qty`, `low_stock_threshold`, and `is_available`.
- **FR-INV-02:** Order confirmation shall execute conditional atomic deduction (`stock_qty >= requested_qty`), returning `409 Conflict` on insufficient stock.
- **FR-INV-03:** `orders.inventory_deducted` and `orders.inventory_restored` flags shall guarantee that stock is never deducted or restored more than once per order.
- **FR-INV-04:** Every stock change (order deduction, restock, cancellation restore, rejection restore, manual adjustment) shall append an immutable record to `inventory_transactions`.
- **FR-INV-05:** When stock drops to or below `low_stock_threshold`, the system shall generate a `low_stock` notification for the stall's vendor.

### 3.4 Vendor Operations (FR-VND)
- **FR-VND-01:** Vendors shall view incoming orders filtered by status and transition orders along `Placed → Accepted → Preparing → Ready → Completed` or `Placed/Accepted → Rejected`.
- **FR-VND-02:** Rejecting an order shall atomically restore stock and refund the simulated payment.
- **FR-VND-03:** Vendors shall upload dish images (`multipart/form-data` via Multer) or choose curated food photography, toggle item availability, and restock items.

### 3.5 Admin Governance (FR-ADM)
- **FR-ADM-01:** Admins shall view platform KPIs, stall-wise revenue charts, and daily order trends.
- **FR-ADM-02:** Admins shall suspend/activate user accounts, create vendor accounts, create/deactivate stalls, update platform settings (`tax_rate_percent`, `platform_fee_flat`, `allow_ordering`, `cancellable_statuses`), and download CSV reports.

---

## 4. Non-Functional Requirements

- **NFR-01 Performance:** API read queries respond in `< 150ms` under typical campus load using indexed SQLite tables.
- **NFR-02 Security:** Passwords hashed with bcrypt (cost 10); Zod input validation on all request bodies; centralized error handling with no stack trace leaks to clients.
- **NFR-03 Reliability & Consistency:** ACID transactions (`BEGIN IMMEDIATE`) serialize concurrent stock deductions to prevent negative stock.
- **NFR-04 Usability:** WCAG AA text contrast, responsive desktop/tablet/mobile layouts, tabular numerals (`tabular-nums`) for all currency and stock counts, skeleton loaders, and non-blocking toast confirmations.
- **NFR-05 Maintainability:** Modular separation across routes, services, middleware, database layer, and React contexts/components.

---

## 5. System Constraints & Assumptions

1. **Simulated Payment Constraint:** No real banking or UPI gateway is connected; all payments are clearly labeled `(Simulated)` for academic demonstration.
2. **Environment Database Adaptation:** While MongoDB was initially considered, the evaluation container provides Node.js v22 without a `mongod` daemon; therefore SQLite (`node:sqlite`) is used for zero-dependency ACID transactions while documenting equivalent MongoDB document schemas in `DatabaseDesign.md`.
3. **Assumption:** Campus food court stalls operate within a single campus timezone and use standardized INR (`₹`) pricing.
