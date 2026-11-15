# Risk Management Plan — CampusBite

| Risk ID | Risk Description | Category | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **RSK-01** | **Concurrent Overselling:** Two students order the last unit of a popular dish simultaneously. | Technical / Data Integrity | High | High | Use SQLite `BEGIN IMMEDIATE` write locks and conditional atomic update (`WHERE stock_qty >= ?`) inside a single transaction. |
| **RSK-02** | **Duplicate Stock Deduction on Network Retry:** Slow campus Wi-Fi causes client retry of checkout POST. | Technical | Medium | High | Enforce unique `idempotency_key` on `orders` plus `inventory_deducted` / `inventory_restored` guard flags. |
| **RSK-03** | **Unauthorized Privilege Escalation:** Student attempts vendor restock or admin account suspension. | Security | Medium | Critical | Enforce JWT verification + `requireRole(...)` middleware and explicit `vendor_id` / `student_id` ownership checks on every route. |
| **RSK-04** | **Kitchen Bottleneck / Missed Low Stock:** Vendor runs out of ingredients mid-rush without noticing. | Operational | High | Medium | Automatically trigger `low_stock` notifications whenever item stock reaches `<= low_stock_threshold` and highlight alerts on Vendor Overview. |
| **RSK-05** | **Database / Environment Portability:** Target host lacks running MongoDB daemon. | Infrastructure | Medium | Medium | Embed SQLite (`node:sqlite`) for zero-daemon deployment while documenting equivalent MongoDB schema mappings in `DatabaseDesign.md`. |
| **RSK-06** | **Broken Dish Images in Production Build:** External image CDNs blocked or broken. | UX / Availability | Medium | Low | Bundle generated dish photography locally via Vite static imports and implement resilient `FoodImage` SVG fallback containers. |
