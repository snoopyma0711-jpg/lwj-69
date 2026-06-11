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

    const tx = db.transaction(() => {
      const order = db
        .prepare('SELECT * FROM repair_orders WHERE id = ?')
        .get(orderId) as RepairOrder | undefined;

      if (!order) {
        res.status(404).json({ error: '工单不存在' });
        return;
      }

      if (order.technician_id !== userId) {
        res.status(403).json({ error: '无权处理此工单' });
        return;
      }

      if (order.status === 'closed') {
        res.status(409).json({
          error: '该工单已被住户关闭，无需再处理。如住户有新需求请让其重新提交报修单。',
          code: 'ORDER_ALREADY_CLOSED'
        });
        return;
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
        res.json({ ...responseData, idempotent: true });
        return;
      }

      if (!['in_progress', 'rework'].includes(order.status)) {
        res.status(400).json({ error: '当前工单状态不允许提交处理结果' });
        return;
      }

      const now = new Date().toISOString();
      const oldStatus = order.status;
      let newStatus: string;
      let message: string;

      if (body.result === 'fixed') {
        newStatus = 'pending_confirm';
        message = '处理完成，等待住户确认';
      } else {
        newStatus = 'in_progress';
        message = body.result === 'revisit' 
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
        message,
        orderId,
        status: newStatus,
        result: body.result
      };

      recordIdempotentOperation(
        idempotencyKey, orderId, 'process_order', userId,
        oldStatus, newStatus, responseData
      );

      res.json(responseData);
    });

    tx();
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
