export type UserRole = 'resident' | 'frontdesk' | 'technician';

export type RepairCategory = 'plumbing' | 'civil' | 'elevator' | 'access' | 'public';

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export type RepairStatus = 
  | 'pending_assign'
  | 'in_progress'
  | 'rework'
  | 'pending_confirm'
  | 'dispute'
  | 'closed';

export type RepairResult = 'fixed' | 'revisit' | 'parts_needed';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  phone: string;
  role: UserRole;
  building?: string;
  room?: string;
  created_at: string;
}

export interface RepairOrder {
  id: number;
  order_no: string;
  resident_id: number;
  category: RepairCategory;
  description: string;
  expected_date: string;
  expected_slot: TimeSlot;
  status: RepairStatus;
  technician_id?: number;
  assigned_at?: string;
  repair_result?: RepairResult;
  repair_note?: string;
  repaired_at?: string;
  reject_count: number;
  last_reject_reason?: string;
  dispute_reason?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  operation_idempotency_key?: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
  realName: string;
}
