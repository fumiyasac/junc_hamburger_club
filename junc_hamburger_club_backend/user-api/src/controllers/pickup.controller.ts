import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { PickupSettingsRow } from '../types';
import { generateSlots, settingsFromRow } from '../lib/pickup_rules';

// ─── 枠一覧 (認証不要) ───────────────────────────────────────────────

export async function getPickupSlots(req: Request, res: Response): Promise<void> {
  const date = req.query.date as string;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ success: false, error: 'date is required (YYYY-MM-DD)' });
    return;
  }

  // 設定取得
  const [settingsRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM pickup_settings WHERE store_id = 1',
  );
  if (settingsRows.length === 0) {
    res.status(500).json({ success: false, error: 'Pickup settings not configured' });
    return;
  }
  const settings = settingsFromRow(settingsRows[0] as PickupSettingsRow);

  const now = new Date();

  // 当日 00:00〜翌日 00:00 (JST) の範囲で reserved_count を一括取得
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT slot_at, reserved_count FROM pickup_slot_counters
     WHERE store_id = 1
       AND slot_at >= ? AND slot_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [`${date} 00:00:00`, `${date} 00:00:00`],
  );
  const reservedMap = new Map<string, number>();
  for (const row of countRows) {
    reservedMap.set((row['slot_at'] as Date).toISOString(), row['reserved_count'] as number);
  }

  const result = generateSlots(date, settings, now, reservedMap);

  res.json({
    success: true,
    data: {
      date,
      closed: result.closed,
      closedReason: result.closedReason,
      slots: result.slots.map((s) => {
        const reserved = reservedMap.get(s.startAt.toISOString()) ?? 0;
        const remaining = settings.slotCapacity - reserved;
        return {
          startAt: formatJstIso(s.startAt),
          available: s.reason === null,
          remaining,
          reason: s.reason,
        };
      }),
    },
  });

}

// real UTC Date を JST 基準の ISO 8601 文字列 "YYYY-MM-DDTHH:MM:SS+09:00" に整形する。
function formatJstIso(realUtc: Date): string {
  const shifted = new Date(realUtc.getTime() + 9 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const da = String(shifted.getUTCDate()).padStart(2, '0');
  const h = String(shifted.getUTCHours()).padStart(2, '0');
  const mi = String(shifted.getUTCMinutes()).padStart(2, '0');
  const se = String(shifted.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${da}T${h}:${mi}:${se}+09:00`;
}
export { formatJstIso };
