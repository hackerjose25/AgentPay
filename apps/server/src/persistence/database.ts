import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
}

export interface ReservationPolicy {
  perRequest: bigint;
  perTask: bigint;
  perDay: bigint;
}

export interface ReservationInput {
  requestId: string;
  runId: string;
  payerAccountId: string;
  amountTinybars: bigint;
  recipientAccountId: string;
}

async function scalarBigint(client: PoolClient, text: string, values: readonly unknown[]): Promise<bigint> {
  const result = await client.query<{ total: string }>(text, [...values]);
  return BigInt(result.rows[0]?.total ?? "0");
}

export async function reserveBudgetInTransaction(
  client: PoolClient,
  input: ReservationInput,
  policy: ReservationPolicy
): Promise<{ paymentId: string; reservationId: string; attemptId: string }> {
  if (input.amountTinybars <= 0n || input.amountTinybars > policy.perRequest) {
    throw new Error("PER_REQUEST_BUDGET_EXCEEDED");
  }

  await client.query(
    "INSERT INTO payer_budget_locks (payer_account_id) VALUES ($1) ON CONFLICT (payer_account_id) DO NOTHING",
    [input.payerAccountId]
  );
  await client.query("SELECT payer_account_id FROM payer_budget_locks WHERE payer_account_id = $1 FOR UPDATE", [input.payerAccountId]);

  const taskUsed = await scalarBigint(client, `
      SELECT COALESCE(SUM(amount_tinybars), 0)::text AS total
      FROM budget_reservations
      WHERE run_id = $1 AND status IN ('HELD', 'CONSUMED')
    `, [input.runId]);
  if (taskUsed + input.amountTinybars > policy.perTask) throw new Error("TASK_BUDGET_EXCEEDED");

  const payerUsed = await scalarBigint(client, `
      SELECT COALESCE(SUM(amount_tinybars), 0)::text AS total
      FROM budget_reservations
      WHERE payer_account_id = $1
        AND (status = 'HELD' OR (status = 'CONSUMED' AND reserved_at >= date_trunc('day', now() AT TIME ZONE 'UTC')))
    `, [input.payerAccountId]);
  if (payerUsed + input.amountTinybars > policy.perDay) throw new Error("DAILY_BUDGET_EXCEEDED");

  const paymentId = randomUUID();
  const reservationId = randomUUID();
  const attemptId = randomUUID();
  await client.query(`
      INSERT INTO payments (
        id, request_id, attempt_id, payer_account_id, amount_tinybars,
        asset, network, recipient_account_id, status
      ) VALUES ($1, $2, $3, $4, $5, '0.0.0', 'hedera:testnet', $6, 'RESERVED')
    `, [paymentId, input.requestId, attemptId, input.payerAccountId, input.amountTinybars.toString(), input.recipientAccountId]);
  await client.query(`
      INSERT INTO budget_reservations (id, payment_id, payer_account_id, run_id, amount_tinybars)
      VALUES ($1, $2, $3, $4, $5)
    `, [reservationId, paymentId, input.payerAccountId, input.runId, input.amountTinybars.toString()]);
  return { paymentId, reservationId, attemptId };
}

export async function reserveBudget(
  pool: Pool,
  input: ReservationInput,
  policy: ReservationPolicy
): Promise<{ paymentId: string; reservationId: string; attemptId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reservation = await reserveBudgetInTransaction(client, input, policy);
    await client.query("COMMIT");
    return reservation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
