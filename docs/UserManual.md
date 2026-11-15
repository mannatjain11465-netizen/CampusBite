# User Manual — CampusBite

Welcome to **CampusBite**, the Campus Food Court Order & Inventory Management System.

---

## 1. Demo Credentials (For Evaluation & Viva)
All pre-seeded accounts use the password: **`Campus@123`**

| Role | Email | Notes |
| :--- | :--- | :--- |
| **Student** | `aarav@student.edu` | Browse menu, cart, checkout, track & cancel orders |
| **Student** | `priya@student.edu` | Second student test account |
| **Vendor (Stall 1)** | `grill@campusbite.edu` | Manages *Ember & Brioche* |
| **Vendor (Stall 2)** | `dosa@campusbite.edu` | Manages *Dakshin Spice Kitchen* |
| **Vendor (Stall 3)** | `crust@campusbite.edu` | Manages *Sourdough & Stone* |
| **Vendor (Stall 4)** | `brew@campusbite.edu` | Manages *Roast & Waffle Lab* |
| **Administrator** | `admin@campusbite.edu` | Full campus governance, analytics & CSV reports |

---

## 2. Student Guide
1. **Explore Menu:** Click **Explore Food** on the landing page. Filter by stall, category, keyword, **Veg Only**, or **In Stock Only**.
2. **Add to Cart:** Click **Add to Cart** on available items. Stock limits prevent adding quantities higher than remaining kitchen inventory.
3. **Checkout (Simulated Payment):** Open **Cart**, select a pickup window (e.g. `ASAP (15 mins)` or `01:15 PM`), choose a simulated payment method (`UPI (Simulated)`, `Campus Wallet (Simulated)`, or `Card (Simulated)`), and click **Confirm & Pay**.
4. **Live Order Tracking & Cancellation:** Open **My Orders** to track live kitchen milestones (`Placed → Accepted → Preparing → Ready → Completed`). While an order is `Placed` or `Accepted`, click **Cancel Order & Restore Stock** to cancel and automatically restore inventory.

---

## 3. Food Vendor Guide
1. **Overview & Sales:** View total/today revenue, active kitchen queue count, low-stock alerts, and Recharts daily sales bar charts.
2. **Incoming Orders:** Filter by status and advance orders through `Accept → Start Preparing → Mark Ready → Complete Pickup` (or `Reject` to cancel and restore stock).
3. **Menu Items:** Click **Add Dish** to create items with uploaded photography (`multer`) or gallery images, or click **Available/Paused** to toggle live availability.
4. **Inventory & Restock:** Inspect items below threshold and click **Restock** to add fresh batch quantities with an audit note. Inspect every movement in **Inventory Transaction History**.
5. **Stall Profile:** Update opening hours, prep estimate, or toggle **Counter Open / Closed**.

---

## 4. Campus Administrator Guide
1. **Platform Overview:** Monitor campus-wide revenue, active stalls, order volume, and Recharts revenue-by-stall & daily trend charts.
2. **All Orders Monitor:** Search and filter orders across every food court stall.
3. **Food Stalls & Users:** Register new vendor accounts, add new stalls, activate/deactivate stalls, or suspend/reactivate student and vendor accounts.
4. **Reports & Settings:** Download CSV reports for Orders or Inventory, and configure Campus Name, GST %, Platform Fee, Cancellable Statuses, and Global Ordering toggle.
