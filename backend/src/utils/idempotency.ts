import db from '../db';

export function checkIdempotentOperation(
  idempotencyKey: string
): { exists: boolean; result?: any } {
  const log = db
    .prepare('SELECT * FROM operation_logs WHERE idempotency_key = ?')
    .get(idempotencyKey) as any;

  if (log) {
    return {
      exists: true,
      result: log.details ? JSON.parse(log.details) : null
    };
  }
  return { exists: false };
}

export function recordIdempotentOperation(
  idempotencyKey: string,
  orderId: number,
  operationType: string,
  operatorId: number,
  oldStatus: string | null,
  newStatus: string | null,
  result: any
): void {
  db.prepare(
    `INSERT INTO operation_logs 
     (idempotency_key, order_id, operation_type, operator_id, old_status, new_status, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    idempotencyKey,
    orderId,
    operationType,
    operatorId,
    oldStatus,
    newStatus,
    JSON.stringify(result)
  );
}

export function generateIdempotencyKey(prefix: string, uniquePart: string): string {
  return `${prefix}_${uniquePart}`;
}
