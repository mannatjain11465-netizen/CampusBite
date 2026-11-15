# Testing & Quality Assurance Documentation — CampusBite

## 1. Quality Assurance Strategy
- **Verification:** Static TypeScript compilation (`npm run lint` via `tsc --noEmit`), Vite production bundling (`npm run build`), and Zod runtime schema validation on API endpoints.
- **Validation:** Functional acceptance verification against SRS requirements across Student, Vendor, and Admin flows.
- **Security Testing:** Automated Supertest checks confirming RBAC boundaries (`403 Forbidden`), unauthenticated rejections (`401 Unauthorized`), cross-vendor isolation, and duplicate-email blocking (`409 Conflict`).
- **Performance & Concurrency Considerations:** Database indexes on foreign keys/status columns and `BEGIN IMMEDIATE` write serialization prevent race conditions during concurrent checkout requests.

---

## 2. Executed Test Evidence (`npm test`)
Tests were executed using **Jest** (`NODE_OPTIONS=--experimental-vm-modules`) + **Supertest** against an isolated `:memory:` SQLite instance seeded deterministically before execution.

**Observed Summary:**
- **Test Suites:** `2 passed, 2 total` (`tests/unit/orderRules.test.ts`, `tests/integration/api.test.ts`)
- **Total Tests:** `9 passed, 9 total`
- **Status:** PASS (Exit Code 0)

---

## 3. Detailed Test Cases

### 3.1 Unit Test Cases (`tests/unit/orderRules.test.ts`)

| Test ID | Test Scenario | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UT-01** | Order subtotal, tax, and fee calculation | `subtotal=378, tax=5%, fee=5` | `{subtotal: 378, taxAmount: 18.9, platformFee: 5, totalAmount: 401.9}` | `{378, 18.9, 5, 401.9}` | **PASS** |
| **UT-02** | Student cancellation eligibility rule | `'Placed'`, `'Accepted'`, `'Preparing'`, `'Ready'`, `'Completed'` | `true` for `Placed`/`Accepted`; `false` for `Preparing`/`Ready`/`Completed` | Matched expected booleans | **PASS** |
| **UT-03** | Vendor order lifecycle state transitions | Transitions (`Placed→Accepted`, `Placed→Completed`, `Cancelled→Accepted`, etc.) | Valid lifecycle steps return `true`; illegal jumps return `false` | Matched expected booleans | **PASS** |

### 3.2 Integration & System Test Cases (`tests/integration/api.test.ts`)

| Test ID | Test Scenario | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IT-01** | Health check endpoint availability | `GET /api/health` | `200 OK` with `{ status: 'ok' }` | `200 OK` (`9 ms`) | **PASS** |
| **IT-02** | Student registration & duplicate email rejection | Valid student payload followed by duplicate email | First `201` (`role: 'student'`); second `409 Conflict` | `201` then `409` (`109 ms`) | **PASS** |
| **IT-03** | Role-Based Access Control & cross-vendor isolation | Student accessing `/api/admin/users` & `/api/inventory/vendor`; Vendor 2 editing Vendor 1 item `itm_1` | `403 Forbidden` on all unauthorized endpoints | All returned `403` (`24 ms`) | **PASS** |
| **IT-04** | Atomic stock deduction, idempotency guard & oversell protection | `POST /api/orders` (`qty: 2`, `idempotencyKey`), retry with same key, oversell (`stock+5`), schema cap (`999`) | `201` deducts 2; retry `200 deduplicated`; oversell `409`; cap `400` | Matched `201`, `200`, `409`, `400` (`30 ms`) | **PASS** |
| **IT-05** | Cancellation stock restoration & late-cancel block | Cancel `Placed` order -> verify stock restored & payment refunded; advance 2nd order to `Preparing` -> attempt cancel | First `200 Cancelled` + stock restored; late cancel `409 Conflict` | Matched `200` + restored & `409` (`38 ms`) | **PASS** |
| **IT-06** | Vendor restock & Admin CSV report export | `POST /api/inventory/restock` (`+15` on `itm_2`); `GET /api/admin/reports/export?type=orders` | `200` with updated stock; `200` `text/csv` attachment | Matched `200` & CSV payload (`14 ms`) | **PASS** |

---

## 4. Defect Log Caught & Resolved During Testing
1. **Defect #1 (SQLite Parameter Binding Mismatch):** Initial test run of `IT-04` revealed `ERR_SQLITE_ERROR: column index out of range` in `placeOrdersAtomically` (`server/services/order.service.ts`) due to an extra `'order_deduction'` argument passed alongside a hardcoded SQL literal. Fixed and verified via `npm test`.
2. **Defect #2 (Zod Cap Precedence):** Verified that quantities exceeding the per-line limit (`50`) return `400 Bad Request` before hitting database stock checks (`409 Conflict`).
