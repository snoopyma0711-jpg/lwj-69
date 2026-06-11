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

export const CATEGORY_OPTIONS: { value: RepairCategory; label: string; color: string }[] = [
  { value: 'plumbing', label: '水电', color: '#1677ff' },
  { value: 'civil', label: '土建', color: '#52c41a' },
  { value: 'elevator', label: '电梯', color: '#faad14' },
  { value: 'access', label: '门禁', color: '#722ed1' },
  { value: 'public', label: '公共设施', color: '#eb2f96' }
];

export const SLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'morning', label: '上午 (8:00-12:00)' },
  { value: 'afternoon', label: '下午 (13:00-17:00)' },
  { value: 'evening', label: '晚间 (18:00-21:00)' }
];

export const STATUS_OPTIONS: Record<RepairStatus, { label: string; color: string }> = {
  pending_assign: { label: '待分派', color: 'gold' },
  in_progress: { label: '进行中', color: 'blue' },
  rework: { label: '返修中', color: 'orange' },
  pending_confirm: { label: '待确认', color: 'cyan' },
  dispute: { label: '争议单', color: 'purple' },
  closed: { label: '已关闭', color: 'green' }
};

export const RESULT_OPTIONS: { value: RepairResult; label: string }[] = [
  { value: 'fixed', label: '修好了' },
  { value: 'revisit', label: '需要二次上门' },
  { value: 'parts_needed', label: '需要外部采购配件' }
];

export interface RepairOrder {
  id: number;
  orderNo: string;
  category: RepairCategory;
  description: string;
  expectedDate: string;
  expectedSlot: TimeSlot;
  status: RepairStatus;
  residentName?: string;
  residentPhone?: string;
  building?: string;
  room?: string;
  technicianName?: string;
  technicianPhone?: string;
  repairResult?: RepairResult;
  repairNote?: string;
  rejectCount: number;
  lastRejectReason?: string;
  disputeReason?: string;
  createdAt: string;
  assignedAt?: string;
  repairedAt?: string;
  closedAt?: string;
  isOverdue?: boolean;
}

export interface Technician {
  id: number;
  realName: string;
  username: string;
  phone: string;
}
