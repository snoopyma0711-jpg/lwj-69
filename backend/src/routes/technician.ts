import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { AuthRequest, authMiddleware, requireRoles } from '../middleware/auth';
import { RepairOrder, RepairResult } from '../types';
import { checkIdempotentOperation, recordIdempotentOperation, generateIdempotencyKey } from '../utils/idempotency';

const router = Router();
router.use(authMiddleware, requireRoles('technician'));

const processOrderSchema = z.object({
  result: z.enum(['fixed', 'revisit', 'parts_needed']),
  note: z.string().min(5, '处理说明至少5个字符').max(500, '说明不能超过500字符'),
  idempotencyKey: z.string().optional()
});

router.get('/stats', (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user!.userId;

    const totalOrders = db
      .prepare(
        `SELECT COUNT(*) as count FROM repair_orders WHERE technician_id = ?`
      )
      .get(userId) as { count: number };

    const ratingStats = db
      .prepare(
        `SELECT 
          COUNT(*) as rated_count,
          COALESCE(AVG(rating), 0) as avg_rating,
          COALESCE(SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END), 0) as good_count
         FROM repair_orders 
         WHERE technician_id = ? AND rating IS NOT NULL`
      )
      .get(userId) as { rated_count: number; avg_rating: number; good_count: number };

    const goodRate = ratingStats.rated_count > 0
      ? Math.round((ratingStats.good_count / ratingStats.rated_count) * 100)
      : 0;

    res.json({
      totalOrders: totalOrders.count,
      avgRating: ratingStats.rated_count > 0
        ? Math.round(ratingStats.avg_rating * 10) / 10
        : 0,
      ratedCount: ratingStats.rated_count,
      goodRate
    });
  } catch (err) {
    console.error('获取师傅统计失败:', err);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

router.get('/orders', (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user!.userId;
    
    const orders = db
      .prepare(
        `SELECT ro.*,
          u.real_name as resident_name,
          u.phone as resident_phone,
          u.building,
          u.room
         FROM repair_orders ro
         JOIN users u ON ro.resident_id = u.id
         WHERE ro.technician_id = ?
         ORDER BY 
           CASE ro.expected_date
             WHEN date('now') THEN 0
             ELSE 1
           END,
           ro.expected_date ASC,
           CASE ro.expected_slot
             WHEN 'morning' THEN 1
             WHEN 'afternoon' THEN 2
             WHEN 'evening' THEN 3
           END,
           ro.created_at DESC`
      )
      .all(userId) as any[];

    const formatted = orders.map(o => ({
      id: o.id,
      orderNo: o.order_no,
      category: o.category,
      description: o.description,
      expectedDate: o.expected_date,
      expectedSlot: o.expected_slot,
      status: o.status,
      residentName: o.resident_name,
      residentPhone: o.resident_phone,
      building: o.building,
      room: o.room,
      repairResult: o.repair_result,
      repairNote: o.repair_note,
      rejectCount: o.reject_count,
      lastRejectReason: o.last_reject_reason,
      createdAt: o.created_at,
      assignedAt: o.assigned_at,
      repairedAt: o.repaired_at
    }));

    res.json({ orders: formatted });
  } catch (err) {
    console.error('获取维修工单失败:', err);
    res.status(500).json({ error: '获取维修工单失败' });
  }
});

router.post('/orders/:id/process', (req: AuthRequest, res: Response): void => {
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const body = processOrderSchema.parse(req.body);

    const clientKey = body.idempotencyKey;
    const idempotencyKey = clientKey || generateIdempotencyKey(
      'process_order', `${orderId}_${userId}_${body.result}`
    );

    const idempotent = checkIdempotentOperation(idempotencyKey);
    if (idempotent.exists) {
      res.json({ message: '重复提交，处理结果已保存', ...idempotent.result, idempotent: true });
      return;
    }

    const result = db.transaction(() => {
      const order = db
        .prepare('SELECT * FROM repair_orders WHERE id = ?')
        .get(orderId) as RepairOrder | undefined;

      if (!order) {
        return { type: 'error' as const, status: 404, data: { error: '工单不存在' } };
      }

      if (order.technician_id !== userId) {
        return { type: 'error' as const, status: 403, data: { error: '无权处理此工单' } };
      }

      if (order.status === 'closed') {
        return {
          type: 'error' as const, status: 409,
          data: {
            error: '该工单已被住户关闭，无需再处理。如住户有新需求请让其重新提交报修单。',
            code: 'ORDER_ALREADY_CLOSED'
          }
        };
      }

      if (order.status === 'pending_confirm' && order.repair_result) {
        const responseData = {
          message: '处理结果已提交，等待住户确认中',
          orderId,
          status: 'pending_confirm',
          result: order.repair_result
        };
        recordIdempotentOperation(
          idempotencyKey, orderId, 'process_order', userId,
          order.status, order.status, responseData
        );
        return { type: 'success' as const, data: { ...responseData, idempotent: true } };
      }

      if (!['in_progress', 'rework'].includes(order.status)) {
        return { type: 'error' as const, status: 400, data: { error: '当前工单状态不允许提交处理结果' } };
      }

      const now = new Date().toISOString();
      const oldStatus = order.status;
      let newStatus: string;
      let msg: string;

      if (body.result === 'fixed') {
        newStatus = 'pending_confirm';
        msg = '处理完成，等待住户确认';
      } else {
        newStatus = 'in_progress';
        msg = body.result === 'revisit'
          ? '已记录，将安排二次上门'
          : '已记录，待采购配件后继续处理';
      }

      db.prepare(
        `UPDATE repair_orders 
         SET status = ?, 
             repair_result = ?,
             repair_note = ?,
             repaired_at = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(newStatus, body.result, body.note, now, now, orderId);

      const responseData = {
        message: msg,
        orderId,
        status: newStatus,
        result: body.result
      };

      recordIdempotentOperation(
        idempotencyKey, orderId, 'process_order', userId,
        oldStatus, newStatus, responseData
      );

      return { type: 'success' as const, data: responseData };
    })();

    if (result.type === 'error') {
      res.status(result.status).json(result.data);
    } else {
      res.json(result.data);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
    } else {
      console.error('提交处理结果失败:', err);
      res.status(500).json({ error: '提交处理结果失败' });
    }
  }
});

export default router;
