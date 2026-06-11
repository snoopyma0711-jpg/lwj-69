import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { AuthRequest, authMiddleware, requireRoles } from '../middleware/auth';
import { RepairOrder, User } from '../types';
import { checkIdempotentOperation, recordIdempotentOperation, generateIdempotencyKey } from '../utils/idempotency';

const router = Router();
router.use(authMiddleware, requireRoles('frontdesk'));

const assignOrderSchema = z.object({
  technicianId: z.number().int().positive('请选择维修师傅'),
  idempotencyKey: z.string().optional()
});

const resolveDisputeSchema = z.object({
  action: z.enum(['close', 'reassign']),
  reason: z.string().min(5, '处理说明至少5个字符'),
  newTechnicianId: z.number().int().optional(),
  idempotencyKey: z.string().optional()
});

router.get('/technicians', (req: AuthRequest, res: Response): void => {
  try {
    const technicians = db
      .prepare(
        `SELECT id, real_name, username, phone 
         FROM users 
         WHERE role = 'technician' 
         ORDER BY real_name`
      )
      .all() as any[];

    res.json({ technicians });
  } catch (err) {
    console.error('获取维修师傅列表失败:', err);
    res.status(500).json({ error: '获取维修师傅列表失败' });
  }
});

router.get('/orders/pending-assign', (req: AuthRequest, res: Response): void => {
  try {
    const orders = db
      .prepare(
        `SELECT ro.*,
          u.real_name as resident_name,
          u.phone as resident_phone,
          u.building,
          u.room
         FROM repair_orders ro
         JOIN users u ON ro.resident_id = u.id
         WHERE ro.status = 'pending_assign'
         ORDER BY ro.created_at ASC`
      )
      .all() as any[];

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
      createdAt: o.created_at
    }));

    res.json({ orders: formatted });
  } catch (err) {
    console.error('获取待分派工单失败:', err);
    res.status(500).json({ error: '获取待分派工单失败' });
  }
});

router.get('/orders/kanban', (req: AuthRequest, res: Response): void => {
  try {
    const statuses = ['pending_assign', 'in_progress', 'pending_confirm', 'closed'];
    const reworkAndDispute = ['rework', 'dispute'];
    
    const allOrders = db
      .prepare(
        `SELECT ro.*,
          ru.real_name as resident_name,
          ru.phone as resident_phone,
          ru.building,
          ru.room,
          tu.real_name as technician_name,
          tu.phone as technician_phone
         FROM repair_orders ro
         JOIN users ru ON ro.resident_id = ru.id
         LEFT JOIN users tu ON ro.technician_id = tu.id
         ORDER BY ro.created_at DESC`
      )
      .all() as any[];

    const formatOrder = (o: any) => ({
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
      technicianName: o.technician_name,
      technicianPhone: o.technician_phone,
      rejectCount: o.reject_count,
      repairResult: o.repair_result,
      disputeReason: o.dispute_reason,
      createdAt: o.created_at,
      assignedAt: o.assigned_at,
      repairedAt: o.repaired_at,
      closedAt: o.closed_at,
      isOverdue: o.status !== 'closed' && 
        new Date(o.created_at).getTime() < Date.now() - 48 * 60 * 60 * 1000
    });

    const kanban: Record<string, any[]> = {
      pending_assign: [],
      in_progress: [],
      pending_confirm: [],
      closed: []
    };

    allOrders.forEach(o => {
      const formatted = formatOrder(o);
      if (o.status === 'pending_assign') {
        kanban.pending_assign.push(formatted);
      } else if (['in_progress', 'rework'].includes(o.status)) {
        kanban.in_progress.push(formatted);
      } else if (['pending_confirm', 'dispute'].includes(o.status)) {
        kanban.pending_confirm.push(formatted);
      } else if (o.status === 'closed') {
        kanban.closed.push(formatted);
      }
    });

    res.json({
      kanban,
      counts: {
        pending_assign: kanban.pending_assign.length,
        in_progress: kanban.in_progress.length,
        pending_confirm: kanban.pending_confirm.length,
        closed: kanban.closed.length,
        rework: allOrders.filter(o => o.status === 'rework').length,
        dispute: allOrders.filter(o => o.status === 'dispute').length
      }
    });
  } catch (err) {
    console.error('获取看板数据失败:', err);
    res.status(500).json({ error: '获取看板数据失败' });
  }
});

router.post('/orders/:id/assign', (req: AuthRequest, res: Response): void => {
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const body = assignOrderSchema.parse(req.body);

    const clientKey = body.idempotencyKey;
    const idempotencyKey = clientKey || generateIdempotencyKey(
      'assign_order', `${orderId}_${body.technicianId}`
    );

    const idempotent = checkIdempotentOperation(idempotencyKey);
    if (idempotent.exists) {
      res.json({ message: '重复操作，工单已分派', ...idempotent.result, idempotent: true });
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

      const technician = db
        .prepare('SELECT * FROM users WHERE id = ? AND role = ?')
        .get(body.technicianId, 'technician') as User | undefined;

      if (!technician) {
        res.status(400).json({ error: '所选维修师傅不存在' });
        return;
      }

      if (order.status === 'in_progress' && order.technician_id === body.technicianId) {
        const responseData = {
          message: '工单已分派给该师傅',
          orderId,
          status: 'in_progress',
          technicianId: body.technicianId
        };
        recordIdempotentOperation(
          idempotencyKey, orderId, 'assign_order', userId,
          order.status, order.status, responseData
        );
        res.json({ ...responseData, idempotent: true });
        return;
      }

      if (!['pending_assign', 'dispute'].includes(order.status)) {
        res.status(400).json({ error: '当前工单状态不允许分派' });
        return;
      }

      const slotOrdersCount = db
        .prepare(
          `SELECT COUNT(*) as count FROM repair_orders 
           WHERE technician_id = ? 
             AND expected_date = ? 
             AND expected_slot = ? 
             AND status IN ('in_progress', 'rework', 'pending_confirm')
             AND id != ?`
        )
        .get(
          body.technicianId,
          order.expected_date,
          order.expected_slot,
          orderId
        ) as { count: number };

      if (slotOrdersCount.count >= 3) {
        res.status(400).json({
          error: `该师傅在${order.expected_date}的这个时段已有3单，请换师傅或换时段`,
          conflictCount: slotOrdersCount.count
        });
        return;
      }

      const now = new Date().toISOString();
      const oldStatus = order.status;
      db.prepare(
        `UPDATE repair_orders 
         SET status = 'in_progress', 
             technician_id = ?, 
             assigned_at = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(body.technicianId, now, now, orderId);

      const responseData = {
        message: `工单已分派给${technician.real_name}`,
        orderId,
        status: 'in_progress',
        technicianId: body.technicianId,
        technicianName: technician.real_name
      };

      recordIdempotentOperation(
        idempotencyKey, orderId, 'assign_order', userId,
        oldStatus, 'in_progress', responseData
      );

      res.json(responseData);
    });

    tx();
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
    } else {
      console.error('分派工单失败:', err);
      res.status(500).json({ error: '分派工单失败' });
    }
  }
});

router.get('/dashboard', (req: AuthRequest, res: Response): void => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const weekStartIso = weekStart.toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const weekNewResult = db
      .prepare('SELECT COUNT(*) as count FROM repair_orders WHERE created_at >= ?')
      .get(weekStartIso) as { count: number };

    const closedOrders = db
      .prepare(
        `SELECT created_at, closed_at 
         FROM repair_orders 
         WHERE status = 'closed' AND closed_at IS NOT NULL`
      )
      .all() as { created_at: string; closed_at: string }[];

    let avgDurationHours = 0;
    if (closedOrders.length > 0) {
      const totalDuration = closedOrders.reduce((sum, o) => {
        return sum + (new Date(o.closed_at).getTime() - new Date(o.created_at).getTime());
      }, 0);
      avgDurationHours = Math.round((totalDuration / closedOrders.length) / (1000 * 60 * 60) * 10) / 10;
    }

    const categoryResult = db
      .prepare(
        `SELECT category, COUNT(*) as count 
         FROM repair_orders 
         GROUP BY category 
         ORDER BY count DESC`
      )
      .all() as { category: string; count: number }[];

    const overdueOrders = db
      .prepare(
        `SELECT ro.*,
          ru.real_name as resident_name,
          ru.building,
          ru.room,
          tu.real_name as technician_name
         FROM repair_orders ro
         JOIN users ru ON ro.resident_id = ru.id
         LEFT JOIN users tu ON ro.technician_id = tu.id
         WHERE ro.status != 'closed' AND ro.created_at < ?
         ORDER BY ro.created_at ASC`
      )
      .all(fortyEightHoursAgo) as any[];

    const categoryMap: Record<string, string> = {
      plumbing: '水电',
      civil: '土建',
      elevator: '电梯',
      access: '门禁',
      public: '公共设施'
    };

    const formattedOverdue = overdueOrders.map(o => ({
      id: o.id,
      orderNo: o.order_no,
      category: categoryMap[o.category] || o.category,
      description: o.description,
      status: o.status,
      residentName: o.resident_name,
      building: o.building,
      room: o.room,
      technicianName: o.technician_name,
      createdAt: o.created_at,
      overdueHours: Math.floor((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60))
    }));

    const categoryDistribution = categoryResult.map(c => ({
      name: categoryMap[c.category] || c.category,
      value: c.count
    }));

    res.json({
      weekNewCount: weekNewResult.count,
      avgDurationHours,
      categoryDistribution,
      overdueOrders: formattedOverdue,
      overdueCount: formattedOverdue.length
    });
  } catch (err) {
    console.error('获取仪表盘数据失败:', err);
    res.status(500).json({ error: '获取仪表盘数据失败' });
  }
});

router.post('/orders/:id/resolve-dispute', (req: AuthRequest, res: Response): void => {
  try {
    const orderId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const body = resolveDisputeSchema.parse(req.body);

    const clientKey = body.idempotencyKey;
    const idempotencyKey = clientKey || generateIdempotencyKey(
      'resolve_dispute', `${orderId}_${body.action}_${Date.now()}`
    );

    const idempotent = checkIdempotentOperation(idempotencyKey);
    if (idempotent.exists) {
      res.json({ message: '重复操作，争议单已处理', ...idempotent.result, idempotent: true });
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

      if (order.status === 'closed') {
        const responseData = {
          message: '工单已经是关闭状态',
          orderId,
          status: 'closed'
        };
        recordIdempotentOperation(
          idempotencyKey, orderId, 'resolve_dispute', userId,
          order.status, order.status, responseData
        );
        res.json({ ...responseData, idempotent: true });
        return;
      }

      if (order.status !== 'dispute') {
        res.status(400).json({ error: '该工单不是争议单状态' });
        return;
      }

      const now = new Date().toISOString();
      let responseData: any;

      if (body.action === 'close') {
        db.prepare(
          `UPDATE repair_orders 
           SET status = 'closed', closed_at = ?, updated_at = ?
           WHERE id = ?`
        ).run(now, now, orderId);

        responseData = {
          message: '争议单已关闭',
          orderId,
          status: 'closed'
        };

        recordIdempotentOperation(
          idempotencyKey, orderId, 'resolve_dispute', userId,
          'dispute', 'closed', responseData
        );
      } else {
        if (!body.newTechnicianId) {
          res.status(400).json({ error: '重新分派需要选择维修师傅' });
          return;
        }

        const technician = db
          .prepare('SELECT * FROM users WHERE id = ? AND role = ?')
          .get(body.newTechnicianId, 'technician') as User | undefined;

        if (!technician) {
          res.status(400).json({ error: '所选维修师傅不存在' });
          return;
        }

        db.prepare(
          `UPDATE repair_orders 
           SET status = 'in_progress', 
               technician_id = ?, 
               assigned_at = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(body.newTechnicianId, now, now, orderId);

        responseData = {
          message: `争议单已重新分派给${technician.real_name}`,
          orderId,
          status: 'in_progress',
          technicianId: body.newTechnicianId
        };

        recordIdempotentOperation(
          idempotencyKey, orderId, 'resolve_dispute', userId,
          'dispute', 'in_progress', responseData
        );
      }

      res.json(responseData);
    });

    tx();
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
    } else {
      console.error('处理争议单失败:', err);
      res.status(500).json({ error: '处理争议单失败' });
    }
  }
});

export default router;
