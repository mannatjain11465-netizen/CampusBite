# CampusBite — Campus Food Court Order & Inventory Management System

CampusBite is a full-stack web application built for campus food courts to connect **Students**, **Food Vendors**, and **Campus Administrators** through real-time order lifecycle tracking and atomic, concurrency-safe inventory management.

---

## Key Features
- **Student Module:** Registration & JWT login, stall & category discovery, search/veg/in-stock filters, persistent stock-capped cart, pickup-slot checkout with simulated payment, real-time order tracking timeline, and rule-based order cancellation with automatic stock restoration.
- **Food Vendor Module:** SaaS kitchen dashboard with incoming order queue (`Placed → Accepted → Preparing → Ready → Completed` or `Rejected`), dish CRUD with Multer image uploads, instant restocking, low-stock alerts, immutable inventory ledger, and Recharts sales analytics.
- **Admin Module:** Enterprise governance console with platform KPIs, revenue-by-stall & daily trend charts, student/vendor account management, stall creation/activation, global inventory monitoring, platform settings, and CSV report exports.
- **Atomic Inventory Engine:** Serialized SQLite transactions (`BEGIN IMMEDIATE`), conditional stock deduction (`WHERE stock_qty >= ?`), idempotency keys preventing duplicate deductions, and single-restore guarantees.

---

## Technology Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide React
- **Backend:** Node.js, Express.js, Zod validation, Multer file uploads
- **Database:** SQLite via Node.js built-in `node:sqlite` (`DatabaseSync`) — *adapted from MongoDB due to sandbox runtime availability without a local `mongod` daemon; see `docs/Architecture.md` and `docs/DatabaseDesign.md` for details and MongoDB mappings.*
- **Authentication:** `bcryptjs` password hashing + JWT (`jsonwebtoken`) + Role-Based Access Control (RBAC)
- **Testing:** Jest + Supertest

---

## Installation & Execution

### 1. Prerequisites
- Node.js `v22.x` or later (for built-in `node:sqlite`)
- `npm` `10.x` or later

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` if running locally and adjust values as needed:
```env
PORT=3000
JWT_SECRET="your_secure_jwt_secret"
DB_PATH="./data/campusbite.db"
```

### 4. Run in Development Mode
Starts the unified Express API + Vite dev server on port `3000`:
```bash
npm run dev
```

### 5. Build & Run in Production Mode
```bash
npm run build
npm start
```

### 6. Run Automated Tests & Type Check
```bash
npm test
npm run lint
```

---

## Demo Credentials (Password: `Campus@123`)
- **Student:** `aarav@student.edu` or `priya@student.edu`
- **Vendor (Ember & Brioche):** `grill@campusbite.edu`
- **Vendor (Dakshin Spice Kitchen):** `dosa@campusbite.edu`
- **Vendor (Sourdough & Stone):** `crust@campusbite.edu`
- **Vendor (Roast & Waffle Lab):** `brew@campusbite.edu`
- **Admin:** `admin@campusbite.edu`

---

## Software Engineering Documentation (`/docs`)
- `docs/SRS.md` — Software Requirements Specification
- `docs/SDLC.md` — Agile SDLC Model & Iterations
- `docs/Architecture.md` — Modular System & Security Architecture
- `docs/DatabaseDesign.md` — ER Diagram, Indexes, Concurrency & MongoDB Mapping
- `docs/DFD.md` — Level 0, Level 1 & Level 2 Data Flow Diagrams
- `docs/diagrams/*.puml` — PlantUML Use Case, Class, Activity, Sequence, Component & Deployment diagrams
- `docs/ProjectPlan.md` — WBS, Gantt Chart, Effort Estimation & Milestones
- `docs/TestingDocumentation.md` — Unit, Integration & System Test Evidence
- `docs/RiskManagement.md` — Risk Register & Mitigations
- `docs/MaintenancePlan.md` — Maintenance Strategy & Git Workflow
- `docs/UserManual.md` — Role-by-Role User Guide
