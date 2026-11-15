import { Router } from 'express';
import { getDb } from '../db/database.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const notifications = db
      .prepare(
        `SELECT * FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 30`
      )
      .all(req.user!.userId);

    const unreadRow = db
      .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user!.userId) as { count: number };

    res.json({
      notifications,
      unreadCount: unreadRow.count,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user!.userId
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/mark-all-read', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
