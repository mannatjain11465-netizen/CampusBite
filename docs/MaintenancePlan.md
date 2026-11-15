# Software Maintenance & Version Control Plan — CampusBite

## 1. Software Maintenance Categories

### 1.1 Corrective Maintenance
- Addressing defects discovered post-deployment (e.g., edge-case validation errors, status polling timeouts, or UI layout overflows on narrow mobile viewports).
- Every bug fix must be accompanied by a regression test case in `tests/unit/` or `tests/integration/`.

### 1.2 Adaptive Maintenance
- Adapting the database adapter from embedded SQLite (`node:sqlite`) to managed MongoDB Atlas or PostgreSQL if campus scale expands beyond a single-node server.
- Replacing simulated payment hooks (`payments.is_simulated = 1`) with an official campus payment gateway or Razorpay/UPI SDK when moving from academic evaluation to production.

### 1.3 Perfective Maintenance
- Adding student favorites/re-order one-click shortcuts, kitchen display sound alerts for new orders, and automated end-of-day PDF financial summaries.
- Optimizing database queries and pagination for historical orders exceeding 50,000 rows.

### 1.4 Preventive Maintenance
- Periodic `PRAGMA integrity_check` and automated backups of `data/campusbite.db`.
- Regular `npm audit` security dependency updates and TypeScript strict checks (`npm run lint`).

---

## 2. Git & GitHub Version Control Strategy
- **Branching Model:** Lightweight Feature-Branch workflow (`main` for stable releases, `feature/<module>` for new modules, `fix/<issue>` for defect patches).
- **Commit Convention (Conventional Commits):**
  - `feat(orders): implement atomic stock deduction and idempotency guard`
  - `fix(db): align SQLite parameter placeholders in order service`
  - `docs(uml): add PlantUML sequence and class diagrams`
  - `test(api): add Supertest integration suite for RBAC and cancellations`
- **Pre-Commit Quality Gate:** Run `npm run lint`, `npm test`, and `npm run build` before merging into `main`.
