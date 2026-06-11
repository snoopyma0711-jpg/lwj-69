import bcrypt from 'bcryptjs';
import db from './db';

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function clearOldData() {
  db.exec(`
    DELETE FROM operation_logs;
    DELETE FROM repair_orders;
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name IN ('users', 'repair_orders', 'operation_logs');
  `);
  db.exec(`VACUUM`);
  console.log('已清空旧数据并重置自增序列');
}

function insertUsers() {
  const users = [
    {
      username: 'admin',
      password: '123456',
      real_name: '王主管',
      phone: '13800000001',
      role: 'frontdesk',
      building: null,
      room: null
    },
    {
      username: 'resident1',
      password: '123456',
      real_name: '张先生',
      phone: '13900000001',
      role: 'resident',
      building: '1号楼',
      room: '101室'
    },
    {
      username: 'resident2',
      password: '123456',
      real_name: '李女士',
      phone: '13900000002',
      role: 'resident',
      building: '2号楼',
      room: '302室'
    },
    {
      username: 'resident3',
      password: '123456',
      real_name: '王先生',
      phone: '13900000003',
      role: 'resident',
      building: '3号楼',
      room: '501室'
    },
    {
      username: 'resident4',
      password: '123456',
      real_name: '赵女士',
      phone: '13900000004',
      role: 'resident',
      building: '4号楼',
      room: '203室'
    },
    {
      username: 'resident5',
      password: '123456',
      real_name: '刘先生',
      phone: '13900000005',
      role: 'resident',
      building: '5号楼',
      room: '601室'
    },
    {
      username: 'tech1',
      password: '123456',
      real_name: '张师傅',
      phone: '13700000001',
      role: 'technician',
      building: null,
      room: null
    },
    {
      username: 'tech2',
      password: '123456',
      real_name: '李师傅',
      phone: '13700000002',
      role: 'technician',
      building: null,
      room: null
    },
    {
      username: 'tech3',
      password: '123456',
      real_name: '王师傅',
      phone: '13700000003',
      role: 'technician',
      building: null,
      room: null
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO users (username, password_hash, real_name, phone, role, building, room)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    users.forEach(user => {
      insertStmt.run(
        user.username,
        hashPassword(user.password),
        user.real_name,
        user.phone,
        user.role,
        user.building,
        user.room
      );
    });
  });

  tx();
  console.log(`已插入 ${users.length} 个用户`);
  return users;
}

function getUserIdMap(): Record<string, number> {
  const rows = db.prepare('SELECT id, username FROM users').all() as any[];
  const map: Record<string, number> = {};
  rows.forEach(row => {
    map[row.username] = row.id;
  });
  return map;
}

function generateOrderNo(index: number): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  return `BX${timestamp}${String(index).padStart(3, '0')}`;
}

function insertSampleOrders(userIdMap: Record<string, number>) {
  const orders = [
    {
      residentUsername: 'resident1',
      category: 'plumbing',
      description: '厨房水龙头漏水，水量较大，希望尽快处理。',
      expectedDateOffset: 0,
      expectedSlot: 'morning' as const,
      status: 'pending_assign' as const,
      techUsername: null
    },
    {
      residentUsername: 'resident2',
      category: 'elevator',
      description: '2号楼东侧电梯按钮失灵，按了没反应。',
      expectedDateOffset: 0,
      expectedSlot: 'afternoon' as const,
      status: 'pending_assign' as const,
      techUsername: null
    },
    {
      residentUsername: 'resident3',
      category: 'access',
      description: '单元门门禁刷卡无反应，无法正常开门。',
      expectedDateOffset: 0,
      expectedSlot: 'morning' as const,
      status: 'in_progress' as const,
      techUsername: 'tech1'
    },
    {
      residentUsername: 'resident2',
      category: 'civil',
      description: '卧室墙面有裂纹，需要检查并修补。',
      expectedDateOffset: 0,
      expectedSlot: 'afternoon' as const,
      status: 'pending_confirm' as const,
      techUsername: 'tech2'
    },
    {
      residentUsername: 'resident4',
      category: 'public',
      description: '小区花园路灯有几盏不亮，夜间行走不便。',
      expectedDateOffset: 0,
      expectedSlot: 'evening' as const,
      status: 'closed' as const,
      techUsername: 'tech1'
    },
    {
      residentUsername: 'resident2',
      category: 'plumbing',
      description: '卫生间下水道堵塞，排水困难。',
      expectedDateOffset: -2,
      expectedSlot: 'morning' as const,
      status: 'in_progress' as const,
      techUsername: 'tech1'
    },
    {
      residentUsername: 'resident5',
      category: 'elevator',
      description: '5号楼电梯运行时有异响，速度不稳。',
      expectedDateOffset: -3,
      expectedSlot: 'afternoon' as const,
      status: 'closed' as const,
      techUsername: 'tech3'
    },
    {
      residentUsername: 'resident4',
      category: 'plumbing',
      description: '客厅空调排水管漏水，滴到地板上。',
      expectedDateOffset: -5,
      expectedSlot: 'evening' as const,
      status: 'closed' as const,
      techUsername: 'tech2'
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO repair_orders 
    (order_no, resident_id, category, description, expected_date, expected_slot, 
     status, technician_id, assigned_at, created_at, updated_at, closed_at, repaired_at,
     repair_result, repair_note, reject_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    orders.forEach((order, index) => {
      const residentId = userIdMap[order.residentUsername];
      const techId = order.techUsername ? userIdMap[order.techUsername] : null;

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + order.expectedDateOffset);

      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 3));
      const assignedAt = techId ? new Date(createdAt.getTime() + 3600000) : null;
      const repairedAt = order.status === 'pending_confirm' || order.status === 'closed'
        ? new Date((assignedAt || createdAt).getTime() + 7200000)
        : null;
      const closedAt = order.status === 'closed'
        ? new Date((repairedAt || createdAt).getTime() + 3600000)
        : null;

      const repairResult = (order.status === 'closed' || order.status === 'pending_confirm')
        ? 'fixed' : null;
      const repairNote = (order.status === 'closed')
        ? '问题已处理完毕，设备恢复正常。'
        : (order.status === 'pending_confirm')
          ? '已上门检查，问题已修复，请确认是否满意。'
          : null;

      insertStmt.run(
        generateOrderNo(index),
        residentId,
        order.category,
        order.description,
        expectedDate.toISOString().split('T')[0],
        order.expectedSlot,
        order.status,
        techId,
        assignedAt ? assignedAt.toISOString() : null,
        createdAt.toISOString(),
        new Date().toISOString(),
        closedAt ? closedAt.toISOString() : null,
        repairedAt ? repairedAt.toISOString() : null,
        repairResult,
        repairNote,
        0
      );
    });
  });

  tx();
  console.log(`已插入 ${orders.length} 个示例工单`);
}

console.log('开始初始化测试数据...\n');

clearOldData();
insertUsers();
const userIdMap = getUserIdMap();
insertSampleOrders(userIdMap);

const counts = {
  users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count,
  orders: (db.prepare('SELECT COUNT(*) as count FROM repair_orders').get() as any).count
};

console.log(`\n===== 初始化完成 =====`);
console.log(`用户总数: ${counts.users}`);
console.log(`工单总数: ${counts.orders}`);
console.log(`\n测试账号列表:`);
console.log(`  物业前台: admin / 123456 (王主管)`);
console.log(`  住户用户: resident1 / 123456 (张先生 1-101)`);
console.log(`  住户用户: resident2 / 123456 (李女士 2-302)`);
console.log(`  住户用户: resident3 / 123456 (王先生 3-501)`);
console.log(`  住户用户: resident4 / 123456 (赵女士 4-203)`);
console.log(`  住户用户: resident5 / 123456 (刘先生 5-601)`);
console.log(`  维修师傅: tech1 / 123456 (张师傅)`);
console.log(`  维修师傅: tech2 / 123456 (李师傅)`);
console.log(`  维修师傅: tech3 / 123456 (王师傅)`)
