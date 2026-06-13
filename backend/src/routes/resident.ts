import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { AuthRequest, authMiddleware, requireRoles } from '../middleware/auth';
import { RepairOrder, RepairCategory, TimeSlot, RepairStatus } from '../types';
import { checkIdempotentOperation, recordIdempotentOperation, generateIdempotencyKey } from '../utils/idempotency';

const router = Router();
router.use(authMiddleware, requireRoles('resident'));

const createOrderSchema = z.object({
  category: z.enum(['plumbing', 'civil', 'elevator', 'access', 'public']),
  description: z.string().min(5, '问题描述至少5个字符').max(500, '描述不能超过500字符'),
  expectedDate: z.string().min(1, '请选择期望上门日期'),
  expectedSlot: z.enum(['morning', 'afternoon', 'evening']),
  idempotencyKey: z.string().optional()
});

const confirmOrderSchema = z.object({
  rating: z.number().int().min(1, '请为本次维修打分').max(5, '评分最高5星'),
  ratingComment: z.string().max(100, '评价文字不超过100字').optional(),
  idempotencyKey: z.string().optional()
});

const rejectOrderSchema = z.object({
  reason: z.string().min(5, '打回原因至少5个字符').max(200, '原因不能超过200字符'),
  idempotencyKey: z.string().optional()
});

function generateOrderNo(): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BX${timestamp}${random}`;
}

router.post('/orders', (req: AuthRequest, res: Response): void => {
  try {
    const body = createOrderSchema.parse(req.body);
    const userId = req.user!.userId;

    const clientKey = body.idempotencyKey;
    const idempotencyKey = clientKey || generateIdempotencyKey(
      'create_order',
      `${userId}_${body.category}_${body.expectedDate}_${body.expectedSlot}_${Date.now()}`
    );

    const idempotent = checkIdempotentOperation(idempotencyKey);
    if (idempotent.exists) {
      res.json({ message: '重复提交，工单已创建', ...idempotent.result, idempotent: true });
      return;
    }

    const result = db.transaction(() => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentOrder = db
        .prepare(
          `SELECT id FROM repair_orders 
           WHERE resident_id = ? AND category = ? AND created_at > ? AND status != 'closed'`
        )
        .get(userId, body.category, twentyFourHoursAgo);

      if (recentOrder) {
        return { type: 'error' as const, status: 400, data: { error: '同一类别24小时内只能提交一次报修，请耐心等待处理' } };
      }

      const orderNo = generateOrderNo();
      const insertResult = db
        .prepare(
          `INSERT INTO repair_orders 
           (order_no, resident_id, category, description, expected_date, expected_slot, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending_assign')`
        )
        .run(
          orderNo,
          userId,
          body.category,
          body.description,
          body.expectedDate,
          body.expectedSlot
        );

      const orderId = insertResult.lastInsertRowid as number;
      const order = db
        .prepare('SELECT * FROM repair_orders WHERE id = ?')
        .get(orderId) as RepairOrder;

      const responseData = {
        message: '报修单提交成功',
        order: {
          id: order.id,
          orderNo: order.order_no,
          category: order.category,
          description: order.description,
          expectedDate: order.expected_date,
          expectedSlot: order.expected_slot,
          status: order.status,
          createdAt: order.created_at
        }
      };

      recordIdempotentOperation(
        idempotencyKey,
        orderId,
        'create_order',
        userId,
        null,
        'pending_assign',
        responseData
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
      console.error('创建报修单失败:', err);
      res.status(500).json({ error: '提交报修单失败' });
    }
  }
});

router.get('/orders', (req: AuthRequest, res: Response): void => {
  try {
    const userId = req.user!.userId;
    const orders = db
      .prepare(
        `SELECT ro.*, 
          u.real_name as technician_name,
          u.phone as technician_phone
         FROM repair_orders ro
         LEFT JOIN users u ON ro.technician_id = u.id
         WHERE ro.resident_id = ?
         ORDER BY ro.created_at DESC`
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
      technicianName: o.technician_name,
      technicianPhone: o.technician_phone,
      repairResult: o.repair_result,
      repairNote: o.repair_note,
      rejectCount: o.reject_count,
      lastRejectReason: o.last_reject_reason,
      disputeReason: o.dispute_reason,
      rating: o.rating,
      ratingComment: o.rating_comment,
      createdAt: o.created_at,
      assignedAt: o.assigned_at,
      repairedAt: o.repaired_at,
      closedAt: o.closed_at
    }));

    res.json({ orders: formatted });
  } catch (err) {
    console.error('查询报修单失败:', err);
    res.status(500).json({ error: '查询报修单失败' });
  }
});

router.post('/orders/:id/confirm', (req: AuthRequest, res: Response): void => {
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const body = confirmOrderSchema.parse(req.body);

    const clientKey = body.idempotencyKey;
    const idempotencyKey = clientKey || generateIdempotencyKey('confirm_order', `${orderId}_${userId}`);

    const idempotent = checkIdempotentOperation(idempotencyKey);
    if (idempotent.exists) {
      res.json({ message: '重复操作，工单已确认关闭', ...idempotent.result, idempotent: true });
      return;
    }

    const result = db.transaction(() => {
      const order = db
        .prepare('SELECT * FROM repair_orders WHERE id = ? AND resident_id = ?')
        .get(orderId, userId) as RepairOrder | undefined;

      if (!order) {
        return { type: 'error' as const, status: 404, data: { error: '工单不存在' } };
      }

      if (order.status === 'closed') {
        const responseData = {
          message: '工单已经是关闭状态',
          orderId,
          status: 'closed'
        };
        recordIdempotentOperation(
          idempotencyKey, orderId, 'confirm_order', userId,
          order.status, order.status, responseData
        );
        return { type: 'success' as const, data: { ...responseData, idempotent: true } };
      }

      if (order.status !== 'pending_confirm') {
        return { type: 'error' as const, status: 400, data: { error: '当前工单状态不允许确认关单' } };
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE repair_orders 
         SET status = 'closed', closed_at = ?, rating = ?, rating_comment = ?, updated_at = ?
         WHERE id = ?`
      ).run(now, body.rating, body.ratingComment || null, now, orderId);

      const responseData = {
        message: '确认成功，工单已关闭',
        orderId,
        status: 'closed',
        rating: body.rating
      };

      recordIdempotentOperation(
        idempotencyKey, orderId, 'confirm_order', userId,
        'pending_confirm', 'closed', responseData
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
      console.error('确认工单失败:', err);
      res.status(500).json({ error: '确认操作失败' });
    }
  }
});

router.post('/orders/:id/reject', (req: AuthRequest, res: Response): void => {
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const body = rejectOrderSchema.parse(req.body);

    const clientKey = body.idempotencyKey;
    const idempotencyKey = clientKey || generateIdempotencyKey(
      'reject_order', `${orderId}_${userId}_${body.reason.substring(0, 10)}`
    );

    const idempotent = checkIdempotentOperation(idempotencyKey);
    if (idempotent.exists) {
      res.json({ message: '重复操作，工单已打回', ...idempotent.result, idempotent: true });
      return;
    }

    const result = db.transaction(() => {
      const order = db
        .prepare('SELECT * FROM repair_orders WHERE id = ? AND resident_id = ?')
        .get(orderId, userId) as RepairOrder | undefined;

      if (!order) {
        return { type: 'error' as const, status: 404, data: { error: '工单不存在' } };
      }

      if (order.status === 'closed') {
        return { type: 'error' as const, status: 409, data: { error: '工单已被关闭，无法打回。如有新问题请重新提交报修单。' } };
      }

      if (order.status === 'dispute') {
        return { type: 'error' as const, status: 400, data: { error: '工单已升级为争议单，等待前台处理' } };
      }

      if (order.status !== 'pending_confirm') {
        return { type: 'error' as const, status: 400, data: { error: '当前工单状态不允许打回' } };
      }

      const newRejectCount = order.reject_count + 1;
      const now = new Date().toISOString();
      let newStatus: RepairStatus;
      let msg: string;

      if (newRejectCount >= 3) {
        newStatus = 'dispute';
        msg = '打回次数已达上限，工单已升级为争议单，前台将人工介入处理';
        db.prepare(
          `UPDATE repair_orders 
           SET status = 'dispute', 
               reject_count = ?, 
               last_reject_reason = ?,
               dispute_reason = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(newRejectCount, body.reason, body.reason, now, orderId);
      } else {
        newStatus = 'rework';
        msg = `工单已打回维修师傅返修（第${newRejectCount}次）`;
        db.prepare(
          `UPDATE repair_orders 
           SET status = 'rework', 
               reject_count = ?, 
               last_reject_reason = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(newRejectCount, body.reason, now, orderId);
      }

      const responseData = {
        message: msg,
        orderId,
        status: newStatus,
        rejectCount: newRejectCount
      };

      recordIdempotentOperation(
        idempotencyKey, orderId, 'reject_order', userId,
        'pending_confirm', newStatus, responseData
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
      console.error('打回工单失败:', err);
      res.status(500).json({ error: '打回操作失败' });
    }
  }
});

export default router;
