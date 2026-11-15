# Software Development Life Cycle (SDLC) — Agile Model

**Project:** CampusBite  
**Methodology:** Iterative Agile SDLC (Solo Developer Adaptation)  

---

## 1. Why Agile SDLC?
CampusBite spans three distinct user personas (Student, Vendor, Admin) with interdependent transactional workflows (cart checkout, atomic stock deduction, kitchen preparation queue, and administrative analytics). An Agile iterative model allows each vertical slice to be designed, implemented, tested, and verified before moving to the next increment, reducing integration risk for a solo B.Tech developer.

---

## 2. SDLC Phases Applied

1. **Requirement Gathering & Analysis:** Interviewed common campus food-court pain points, defined user stories for Student/Vendor/Admin, and formalized `SRS.md`.
2. **Planning:** Created a Work Breakdown Structure (WBS), solo developer effort estimates, and milestone schedule (`ProjectPlan.md`).
3. **System Design:** Designed modular Express layered architecture, SQLite relational schema with ACID guarantees, DFDs, and 6 PlantUML UML diagrams.
4. **Implementation:** Executed incrementally across 9 structured phases from design system and database schema through full-stack feature integration.
5. **Testing:** Executed Jest unit tests and Supertest API integration tests against an isolated in-memory database, fixing discovered defects prior to release.
6. **Deployment:** Bundled frontend with Vite (`npm run build`) and served statically alongside Express API on port 3000 (`npm start`).
7. **Maintenance:** Defined corrective, adaptive, perfective, and preventive maintenance procedures (`MaintenancePlan.md`).

---

## 3. Iteration Breakdown & Deliverables

| Iteration | Focus Area | Key Deliverables | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | Foundation & Design System | `metadata.json`, Tailwind v4 theme tokens, typography, 8 food photography assets, folder architecture | Visual token check & build check |
| **Sprint 2** | Database & Auth Core | SQLite schema (9 tables + indexes), idempotent seed data, bcrypt + JWT auth, RBAC middleware | `POST /api/auth/register` & `/login` verified |
| **Sprint 3** | Order & Inventory Engine | Atomic stock deduction (`BEGIN IMMEDIATE`), idempotency guard, cancellation/rejection stock restore, audit ledger | Zero-overselling & duplicate-deduction tests |
| **Sprint 4** | Landing & Student Module | Landing page, `StudentDashboard`, search/filters, `CartDrawer`, simulated checkout, live order tracking timeline | End-to-end student checkout & cancel flow |
| **Sprint 5** | Vendor & Admin Consoles | `VendorDashboard` (orders, menu CRUD + Multer upload, restock, Recharts), `AdminDashboard` (KPIs, users, stalls, CSV export, settings) | Role isolation & dashboard CRUD verification |
| **Sprint 6** | QA, Testing & Docs | Jest unit tests, Supertest integration suite, TypeScript lint, production build, full `/docs` suite & PlantUML diagrams | `npm test`, `npm run lint`, `npm run build` |
