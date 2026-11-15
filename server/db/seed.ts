import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';

export function seedDatabase(db: DatabaseSync): void {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers.count > 0) {
    return;
  }

  const now = new Date().toISOString();
  const daysAgo = (days: number, hourOffset = 0) => {
    const d = new Date(Date.now() - days * 86400000 - hourOffset * 3600000);
    return d.toISOString();
  };

  const passwordHash = bcrypt.hashSync('Campus@123', 10);

  db.exec('BEGIN IMMEDIATE');
  try {
    // Platform Settings
    db.prepare(`
      INSERT INTO platform_settings (id, campus_name, tax_rate_percent, platform_fee_flat, allow_ordering, cancellable_statuses, default_low_stock_threshold, updated_at)
      VALUES (1, ?, 5.0, 5.0, 1, 'Placed,Accepted', 10, ?)
    `).run('IIIT Allahabad Campus Food Court', now);

    // Users: 1 Admin, 4 Vendors, 2 Students
    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, campus_id, phone, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    insertUser.run('usr_admin_1', 'Dr. Kavita Rao', 'admin@campusbite.edu', passwordHash, 'admin', 'IIITA-ADM-01', '9800000001', daysAgo(30), now);
    insertUser.run('usr_vendor_1', 'Rohan Malhotra', 'grill@campusbite.edu', passwordHash, 'vendor', 'DEMO-VND-01', '9800000101', daysAgo(28), now);
    insertUser.run('usr_vendor_2', 'Meenakshi Iyer', 'dosa@campusbite.edu', passwordHash, 'vendor', 'DEMO-VND-02', '9800000102', daysAgo(28), now);
    insertUser.run('usr_vendor_3', 'Arjun Verma', 'crust@campusbite.edu', passwordHash, 'vendor', 'DEMO-VND-03', '9800000103', daysAgo(26), now);
    insertUser.run('usr_vendor_4', 'Sana Kapoor', 'brew@campusbite.edu', passwordHash, 'vendor', 'DEMO-VND-04', '9800000104', daysAgo(25), now);
    insertUser.run('usr_student_1', 'Aarav Sharma', 'aarav@student.edu', passwordHash, 'student', 'IIT2024042', '9811112222', daysAgo(20), now);
    insertUser.run('usr_student_2', 'Priya Nair', 'priya@student.edu', passwordHash, 'student', 'IIT2024118', '9811113333', daysAgo(18), now);

    // Clearly identified Demo Food Stalls for IIIT Allahabad, Prayagraj (editable in Vendor/Admin consoles)
    const insertStall = db.prepare(`
      INSERT INTO food_stalls (id, vendor_id, name, slug, description, cuisine_type, location, opening_hours, avg_prep_minutes, rating, image_url, is_open, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
    `);

    insertStall.run(
      'stl_1',
      'usr_vendor_1',
      'Demo Counter 01 · Burgers & Rolls',
      'demo-burgers-rolls',
      'Editable demo stall serving smash burgers, tandoori paneer rolls, and Bombay grilled sandwiches.',
      'Burgers, Rolls & Sandwiches',
      'Food Court Plaza, Demo Bay 01 (Prayagraj)',
      '09:00 AM - 10:30 PM',
      12,
      4.8,
      '/src/assets/images/food_smash_burger_1794579764199.jpg',
      daysAgo(25),
      now
    );

    insertStall.run(
      'stl_2',
      'usr_vendor_2',
      'Demo Counter 02 · Dakshin & Momos',
      'demo-dakshin-momos',
      'Editable demo stall serving crispy ghee roast dosas, steamed Himalayan momos, and hot noodle bowls.',
      'South Indian & Momos',
      'Food Court Plaza, Demo Bay 02 (Prayagraj)',
      '07:30 AM - 09:30 PM',
      10,
      4.9,
      '/src/assets/images/food_masala_dosa_bowl_1794579763985.jpg',
      daysAgo(25),
      now
    );

    insertStall.run(
      'stl_3',
      'usr_vendor_3',
      'Demo Counter 03 · North Indian & Pizza',
      'demo-north-indian-pizza',
      'Editable demo stall offering Amritsari chole bhature, Punjabi samosas, and stone-baked pizzas.',
      'North Indian & Chaat',
      'Lecture Hall Atrium, Demo Bay 03 (Prayagraj)',
      '08:30 AM - 11:00 PM',
      14,
      4.7,
      '/src/assets/images/food_chole_bhature_1794580910865.jpg',
      daysAgo(24),
      now
    );

    insertStall.run(
      'stl_4',
      'usr_vendor_4',
      'Demo Counter 04 · Chai & Cold Coffee',
      'demo-chai-cold-coffee',
      'Editable demo cafe serving kulhad masala chai, cold coffee, iced caramel lattes, and Belgian waffles.',
      'Chai, Cold Coffee & Desserts',
      'Library Pavilion, Demo Bay 04 (Prayagraj)',
      '08:00 AM - 11:45 PM',
      7,
      4.8,
      '/src/assets/images/food_iced_coffee_cafe_1794579764575.jpg',
      daysAgo(24),
      now
    );

    // Menu Items (15 campus-authentic Indian & fusion items across 4 demo stalls)
    const insertItem = db.prepare(`
      INSERT INTO menu_items (id, stall_id, name, description, category, price, image_url, is_veg, is_bestseller, prep_minutes, stock_qty, low_stock_threshold, is_available, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertItem.run(
      'itm_1', 'stl_1', 'Double Cheddar Smash Burger',
      'Two seared patties with aged sharp cheddar, house chipotle sauce, pickled onions, and toasted brioche bun.',
      'Burgers', 149, '/src/assets/images/food_smash_burger_1794579764199.jpg', 0, 1, 12, 24, 8, 1, daysAgo(20), now
    );
    insertItem.run(
      'itm_2', 'stl_1', 'Charred Paneer Tikka Roll',
      'Smoky tandoori paneer cubes, charred bell peppers, and cooling mint chutney wrapped in flaky roomali paratha.',
      'Rolls & Wraps', 119, '/src/assets/images/food_paneer_tikka_wrap_1794579765696.jpg', 1, 1, 10, 6, 10, 1, daysAgo(20), now
    );
    insertItem.run(
      'itm_3', 'stl_1', 'Bombay Masala Cheese Sandwich',
      'Triple-layered toasted sandwich stuffed with spiced potato masala, melted cheddar, capsicum, and green chutney.',
      'Sandwiches', 95, '/src/assets/images/food_grilled_sandwich_1794580911407.jpg', 1, 1, 8, 22, 8, 1, daysAgo(18), now
    );

    insertItem.run(
      'itm_4', 'stl_2', 'Ghee Roast Masala Dosa',
      'Crispy golden fermented crepe roasted in desi ghee, filled with potato masala, fresh coconut chutney, and hot sambar.',
      'Dosa & South Indian', 90, '/src/assets/images/food_masala_dosa_bowl_1794579763985.jpg', 1, 1, 8, 35, 10, 1, daysAgo(20), now
    );
    insertItem.run(
      'itm_5', 'stl_2', 'Steamed Himalayan Veg Momos (8 pcs)',
      'Hand-pleated soft dumplings packed with ginger-garlic veggies, served with fiery Prayagraj red chili-garlic chutney.',
      'Momos', 80, '/src/assets/images/food_steamed_momos_1794580912999.jpg', 1, 1, 9, 28, 10, 1, daysAgo(19), now
    );
    insertItem.run(
      'itm_6', 'stl_2', 'Crispy Tofu Ramen Bowl',
      'Rich soy-ginger vegetable broth with hand-pulled noodles, crispy golden tofu, bok choy, and toasted sesame.',
      'Bowls & Noodles', 169, '/src/assets/images/food_korean_ramen_bowl_1794579765988.jpg', 1, 0, 12, 14, 6, 1, daysAgo(17), now
    );

    insertItem.run(
      'itm_7', 'stl_3', 'Wood-Fired Margherita Pizza',
      '48-hour sourdough crust topped with crushed San Marzano tomatoes, fresh mozzarella, and sweet basil leaves.',
      'Pizza', 219, '/src/assets/images/food_woodfired_pizza_1794579764475.jpg', 1, 1, 15, 16, 6, 1, daysAgo(20), now
    );
    insertItem.run(
      'itm_8', 'stl_3', 'Spicy Miso Ramen & Egg Bowl',
      'Slow-simmered chili miso broth with springy ramen noodles, soft-boiled marinated egg, scallions, and nori.',
      'Bowls & Noodles', 189, '/src/assets/images/food_korean_ramen_bowl_1794579765988.jpg', 0, 0, 14, 5, 8, 1, daysAgo(18), now
    );
    insertItem.run(
      'itm_9', 'stl_3', 'Amritsari Chole Bhature',
      'Two fluffy golden puffed bhature paired with slow-cooked spiced pindi chole, pickled onions, and green chutney.',
      'North Indian Meals', 110, '/src/assets/images/food_chole_bhature_1794580910865.jpg', 1, 1, 10, 30, 8, 1, daysAgo(16), now
    );
    insertItem.run(
      'itm_13', 'stl_3', 'Punjabi Samosa & Masala Chai Combo',
      'Two crisp spiced potato-pea samosas with mint and tamarind chutneys paired with hot ginger cardamom chai.',
      'Snacks & Samosa', 55, '/src/assets/images/food_samosa_chai_1794580910303.jpg', 1, 1, 5, 45, 12, 1, daysAgo(16), now
    );

    insertItem.run(
      'itm_10', 'stl_4', 'Classic Campus Cold Coffee',
      'Chilled blended Arabica espresso with thick cream, caramel drizzle, and crystal ice — ideal for afternoon breaks.',
      'Cold Coffee & Chai', 85, '/src/assets/images/food_iced_coffee_cafe_1794579764575.jpg', 1, 1, 5, 42, 12, 1, daysAgo(20), now
    );
    insertItem.run(
      'itm_11', 'stl_4', '18-Hour Iced Cold Brew',
      'Smooth, low-acidity dark roast steeped for 18 hours over cold filtered water with subtle roasted cocoa notes.',
      'Cold Coffee & Chai', 95, '/src/assets/images/food_iced_coffee_cafe_1794579764575.jpg', 1, 0, 3, 28, 10, 1, daysAgo(19), now
    );
    insertItem.run(
      'itm_12', 'stl_4', 'Berry Mascarpone Belgian Waffle',
      'Crisp golden pearl-sugar waffle topped with fresh strawberries, blueberries, whipped mascarpone, and maple drizzle.',
      'Desserts', 145, '/src/assets/images/food_berry_waffle_dessert_1794579766579.jpg', 1, 1, 9, 15, 6, 1, daysAgo(17), now
    );

    // Seed initial inventory transactions
    const insertInvTx = db.prepare(`
      INSERT INTO inventory_transactions (id, menu_item_id, stall_id, type, previous_qty, change_qty, new_qty, reference_id, note, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertInvTx.run('inv_seed_1', 'itm_1', 'stl_1', 'restock', 0, 30, 30, 'INIT-1', 'Initial opening stock', 'usr_vendor_1', daysAgo(7));
    insertInvTx.run('inv_seed_2', 'itm_2', 'stl_1', 'restock', 0, 15, 15, 'INIT-2', 'Initial opening stock', 'usr_vendor_1', daysAgo(7));
    insertInvTx.run('inv_seed_3', 'itm_4', 'stl_2', 'restock', 0, 40, 40, 'INIT-3', 'Morning dosa batter batch', 'usr_vendor_2', daysAgo(5));
    insertInvTx.run('inv_seed_4', 'itm_9', 'stl_3', 'restock', 0, 35, 35, 'INIT-4', 'Morning chole bhature prep', 'usr_vendor_3', daysAgo(3));
    insertInvTx.run('inv_seed_5', 'itm_10', 'stl_4', 'restock', 0, 50, 50, 'INIT-5', 'Cold coffee espresso prep', 'usr_vendor_4', daysAgo(2));

    // Seed historical & active orders across past 6 days
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, order_code, student_id, stall_id, subtotal, tax_amount, platform_fee, total_amount, status, pickup_time, special_instructions, cancellation_reason, idempotency_key, inventory_deducted, inventory_restored, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 1, 0, ?, ?)
    `);
    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, item_name, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payments (id, order_id, student_id, amount, method, status, transaction_ref, is_simulated, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const seedOrders = [
      { id: 'ord_1001', code: 'CB-2026-1001', student: 'usr_student_1', stall: 'stl_1', item: 'itm_1', name: 'Double Cheddar Smash Burger', price: 149, qty: 2, status: 'Completed', pickup: '1:15 PM', day: 5, method: 'UPI (Simulated)' },
      { id: 'ord_1002', code: 'CB-2026-1002', student: 'usr_student_2', stall: 'stl_2', item: 'itm_4', name: 'Ghee Roast Masala Dosa', price: 90, qty: 2, status: 'Completed', pickup: '9:30 AM', day: 4, method: 'Campus Wallet (Simulated)' },
      { id: 'ord_1003', code: 'CB-2026-1003', student: 'usr_student_1', stall: 'stl_3', item: 'itm_9', name: 'Amritsari Chole Bhature', price: 110, qty: 2, status: 'Completed', pickup: '1:30 PM', day: 3, method: 'UPI (Simulated)' },
      { id: 'ord_1004', code: 'CB-2026-1004', student: 'usr_student_2', stall: 'stl_4', item: 'itm_10', name: 'Classic Campus Cold Coffee', price: 85, qty: 2, status: 'Completed', pickup: '4:00 PM', day: 2, method: 'Card (Simulated)' },
      { id: 'ord_1005', code: 'CB-2026-1005', student: 'usr_student_1', stall: 'stl_1', item: 'itm_3', name: 'Bombay Masala Cheese Sandwich', price: 95, qty: 2, status: 'Completed', pickup: '5:15 PM', day: 1, method: 'UPI (Simulated)' },
      { id: 'ord_1006', code: 'CB-2026-1006', student: 'usr_student_1', stall: 'stl_2', item: 'itm_5', name: 'Steamed Himalayan Veg Momos (8 pcs)', price: 80, qty: 1, status: 'Preparing', pickup: 'ASAP (15 mins)', day: 0, method: 'UPI (Simulated)' },
      { id: 'ord_1007', code: 'CB-2026-1007', student: 'usr_student_2', stall: 'stl_4', item: 'itm_12', name: 'Berry Mascarpone Belgian Waffle', price: 145, qty: 1, status: 'Placed', pickup: 'ASAP (15 mins)', day: 0, method: 'Campus Wallet (Simulated)' },
    ];

    seedOrders.forEach((o, idx) => {
      const subtotal = o.price * o.qty;
      const tax = Number((subtotal * 0.05).toFixed(2));
      const fee = 5;
      const total = Number((subtotal + tax + fee).toFixed(2));
      const ts = daysAgo(o.day, idx % 3);

      insertOrder.run(
        o.id, o.code, o.student, o.stall, subtotal, tax, fee, total,
        o.status, o.pickup, 'Extra chutney please', `seed-idem-${o.id}`, ts, ts
      );
      insertOrderItem.run(`oi_${o.id}_1`, o.id, o.item, o.name, o.price, o.qty, subtotal);
      insertPayment.run(`pay_${o.id}`, o.id, o.student, total, o.method, 'Paid (Simulated)', `SIM-PAY-${10000 + idx}`, ts, ts);
    });

    // Seed Notifications for low stock and active orders
    const insertNotif = db.prepare(`
      INSERT INTO notifications (id, user_id, role_target, type, title, message, reference_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    insertNotif.run(
      'ntf_1', 'usr_vendor_1', 'vendor', 'low_stock',
      'Low stock alert: Charred Paneer Tikka Roll',
      'Only 6 units remaining (threshold: 10). Restock soon to prevent break-rush stockouts.',
      'itm_2', daysAgo(0, 1)
    );
    insertNotif.run(
      'ntf_2', 'usr_vendor_3', 'vendor', 'low_stock',
      'Low stock alert: Spicy Miso Ramen & Egg Bowl',
      'Only 5 units remaining (threshold: 8). Restock required.',
      'itm_8', daysAgo(0, 1)
    );
    insertNotif.run(
      'ntf_3', 'usr_vendor_4', 'vendor', 'new_order',
      'New Order CB-2026-1007',
      'Priya Nair placed an order for Berry Mascarpone Belgian Waffle (Pickup: ASAP).',
      'ord_1007', now
    );
    insertNotif.run(
      'ntf_4', 'usr_student_1', 'student', 'order_update',
      'Order CB-2026-1006 is Preparing',
      'Demo Counter 02 has started steaming your Himalayan Veg Momos.',
      'ord_1006', now
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
