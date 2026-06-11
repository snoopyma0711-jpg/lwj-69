import { CATEGORY_OPTIONS, SLOT_OPTIONS, STATUS_OPTIONS, RepairCategory, TimeSlot, RepairStatus, RepairResult, RESULT_OPTIONS } from '../types';

export function getCategoryLabel(category: RepairCategory): string {
  const found = CATEGORY_OPTIONS.find(c => c.value === category);
  return found ? found.label : category;
}

export function getCategoryColor(category: RepairCategory): string {
  const found = CATEGORY_OPTIONS.find(c => c.value === category);
  return found ? found.color : '#1677ff';
}

export function getSlotLabel(slot: TimeSlot): string {
  const found = SLOT_OPTIONS.find(s => s.value === slot);
  return found ? found.label : slot;
}

export function getStatusLabel(status: RepairStatus): string {
  return STATUS_OPTIONS[status]?.label || status;
}

export function getStatusColor(status: RepairStatus): string {
  return STATUS_OPTIONS[status]?.color || 'default';
}

export function getResultLabel(result: RepairResult): string {
  const found = RESULT_OPTIONS.find(r => r.value === result);
  return found ? found.label : result;
}

export function generateIdempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}
