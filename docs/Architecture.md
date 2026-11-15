# System Architecture — CampusBite

## 1. Architectural Style
CampusBite follows a **Modular Monolith / Three-Tier Client-Server Architecture**:
1. **Presentation Layer (React 19 + Vite + Tailwind CSS + Recharts):** Single-Page Application (SPA) organized by domain (`landing`, `student`, `vendor`, `admin`, `common`) with React Context providers (`AuthContext`, `CartContext`, `ToastContext`) and a typed API client (`src/lib/api.ts`).
2. **Application / API Layer (Node.js + Express.js + TypeScript):** Stateless REST API protected by JWT Bearer authentication, RBAC middleware (`requireRole`), Multer file-upload handling, Zod schema validation, and centralized error handling.
3. **Data & Transaction Layer (SQLite via `node:sqlite`):** ACID-compliant relational persistence with foreign-key enforcement (`PRAGMA foreign_keys = ON`), WAL concurrency mode, and indexed lookup tables.

---

## 2. Technology Stack & Environment Adaptation Note
The original project specification listed **MongoDB**. During environment inspection, the runtime container (Debian Bookworm with Node.js v22.23.2) had no local `mongod` service and no `MONGODB_URI` configured. Rather than introducing fragile external binary downloads or silently changing the stack:
- We documented the limitation transparently and adopted **SQLite (`node:sqlite` `DatabaseSync`)** as a zero-dependency embedded ACID engine.
- This provides **stronger transactional atomicity** (`BEGIN IMMEDIATE` + conditional `UPDATE ... WHERE stock_qty >= ?`) for concurrent order placement and inventory restoration.
- Equivalent MongoDB document structures and Mongoose index mappings are preserved in `docs/DatabaseDesign.md` so migrating to MongoDB Atlas in future deployments requires only swapping the repository/service queries.

---

## 3. Separation of Concerns (Backend Modules)

| Directory / File | Responsibility |
| :--- | :--- |
| `server.ts` | Bootstraps Express app on port 3000; mounts Vite dev middleware in development or serves `dist/` in production. |
| `server/app.ts` | Express app factory (decoupled from `listen()` so Supertest can run isolated integration tests). |
| `server/config/env.ts` | Centralized configuration for port, JWT secret, database path, and upload directory. |
| `server/db/database.ts` | Initializes SQLite connection, PRAGMAs, 9 tables, check constraints, and indexes. |
| `server/db/seed.ts` | Idempotent demo seeding (Admin, 4 Vendors, 2 Students, 4 Stalls, 12 Menu Items, historical orders). |
| `server/middleware/auth.ts` | `signAuthToken`, `requireAuth` (JWT verification + active user check), `requireRole` (RBAC). |
| `server/middleware/errorHandler.ts` | Maps `AppError`, `ZodError`, and Multer upload errors into structured JSON HTTP responses. |
| `server/services/order.service.ts` | Pure pricing/transition helpers + atomic order creation, idempotency, cancellation, and vendor lifecycle transitions. |
| `server/services/inventory.service.ts` | Atomic restock, manual stock adjustment, and automated low-stock notification generation. |
| `server/routes/*.ts` | Thin HTTP controllers validating inputs with Zod and delegating business logic to services. |

---

## 4. Security Architecture
- **Password Hashing:** `bcryptjs` with 10 salt rounds (`password_hash` is never returned in API responses).
- **Stateless Auth:** JWT tokens signed with `HS256` and verified against active database user state on every protected request (suspended users are rejected immediately even with a non-expired token).
- **Least Privilege:** Public registration always sets `role = 'student'`. Vendor and Admin accounts are created via seed or Admin APIs.
- **Ownership Enforcement:** Vendors are restricted to records matching `food_stalls.vendor_id === req.user.userId`; students can only inspect or cancel orders where `orders.student_id === req.user.userId`.
