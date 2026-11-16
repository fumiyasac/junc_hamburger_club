// 受け取り枠 (pickup slot) の計算ルール。
// 正本は docs/pickup_slot_rules.md。本ファイルと admin-api/pickup/rules.go は
// その仕様を忠実に実装し、差異が出ないよう境界値テストでガードする。
//
// 全ての時刻は JST (Asia/Tokyo) 基準で処理する。本ファイルでは UTC 時刻を
// JST として扱うため、呼び出し側は MySQL の timezone='+09:00' セッションで
// 受け取った Date を直接渡せばよい (TS の Date は内部 UTC だが、MySQL が
// JST 文字列を "そのまま" UTC として parse するため、"JST 11:00" は
// UTC 11:00 として表現される)。

export interface PickupSettings {
  slotIntervalMin: number;
  slotCapacity: number;
  leadTimeMin: number;
  lookaheadDays: number;
  openTime: string;        // 'HH:MM:SS' JST
  closeTime: string;        // 'HH:MM:SS' JST
  closedWeekdays: number[]; // 0=Sun ... 6=Sat
}

export type SlotReason =
  | 'lead_time'
  | 'out_of_hours'
  | 'full'
  | 'past'
  | 'past_lookahead';

export type ClosedReason = 'closed_weekday' | 'past' | 'past_lookahead';

export interface Slot {
  startAt: Date;          // 枠開始時刻 (JST として扱う)
  reason: SlotReason | null;
}

export interface SlotListResult {
  closed: boolean;
  closedReason: ClosedReason | null;
  slots: Slot[];
}

// ─── CSV ユーティリティ ──────────────────────────────────────────────

export function parseClosedWeekdays(csv: string): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function settingsFromRow(row: {
  slot_interval_min: number;
  slot_capacity: number;
  lead_time_min: number;
  lookahead_days: number;
  open_time: string;
  close_time: string;
  closed_weekdays: string;
}): PickupSettings {
  return {
    slotIntervalMin: row.slot_interval_min,
    slotCapacity: row.slot_capacity,
    leadTimeMin: row.lead_time_min,
    lookaheadDays: row.lookahead_days,
    openTime: row.open_time,
    closeTime: row.close_time,
    closedWeekdays: parseClosedWeekdays(row.closed_weekdays),
  };
}

// ─── 時刻ユーティリティ (全て JST 単位の "分" で扱う) ─────────────────

function timeToMinutes(t: string): number {
  // 'HH:MM:SS' or 'HH:MM' を受けて "0:00 からの分数" を返す
  const parts = t.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

/**
 * date (YYYY-MM-DD, JST) + "分数" を、その JST wall-clock 時刻を指す **real UTC Date** に変換する。
 * (例: jstDateTime('2026-11-16', 11*60) → new Date('2026-11-16T11:00:00+09:00') = UTC 02:00)
 * mysql2 pool は timezone='+09:00' 設定で動いているため、この real UTC Date を INSERT すると
 * JST wall-clock 文字列として MySQL に送られ、意図通り保存される。
 */
export function jstDateTime(dateJst: string, minutesFromMidnight: number): Date {
  const [y, m, d] = dateJst.split('-').map(Number);
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  // JST 時刻 → real UTC (9h 引く)
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm, 0, 0));
}

/** real UTC Date を JST +9h シフトしたものを返す (内部用) */
function shiftToJst(realUtc: Date): Date {
  return new Date(realUtc.getTime() + 9 * 60 * 60 * 1000);
}

/**
 * real UTC Date から JST 暦日文字列 'YYYY-MM-DD' を返す。
 */
export function toJstDateString(realUtc: Date): string {
  const shifted = shiftToJst(realUtc);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** JST 基準の weekday (0=Sun...6=Sat) */
export function jstWeekday(realUtc: Date): number {
  return shiftToJst(realUtc).getUTCDay();
}

/** date (JST) と今 (real UTC) の差を日数で (date - today) */
export function diffDaysJst(dateJst: string, nowRealUtc: Date): number {
  const [y, m, d] = dateJst.split('-').map(Number);
  const targetUtc = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = toJstDateString(nowRealUtc).split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

// ─── 枠リストの生成 ──────────────────────────────────────────────────

export function generateSlots(
  dateJst: string,       // 'YYYY-MM-DD'
  settings: PickupSettings,
  now: Date,
  reservedCounts?: Map<string, number>, // key = startAt.toISOString()
): SlotListResult {
  const weekday = jstWeekday(jstDateTime(dateJst, 0));
  if (settings.closedWeekdays.includes(weekday)) {
    return { closed: true, closedReason: 'closed_weekday', slots: [] };
  }

  const diff = diffDaysJst(dateJst, now);
  if (diff < 0) return { closed: true, closedReason: 'past', slots: [] };
  if (diff >= settings.lookaheadDays) return { closed: true, closedReason: 'past_lookahead', slots: [] };

  const openMin = timeToMinutes(settings.openTime);
  const closeMin = timeToMinutes(settings.closeTime);
  const interval = settings.slotIntervalMin;
  const lastSlotStart = closeMin - interval;

  const slots: Slot[] = [];
  for (let m = openMin; m <= lastSlotStart; m += interval) {
    const startAt = jstDateTime(dateJst, m);
    let reason: SlotReason | null = null;

    // lead_time は当日のみ判定。startAt と now は共に real UTC で比較
    if (diff === 0) {
      const earliest = new Date(now.getTime() + settings.leadTimeMin * 60 * 1000);
      if (startAt < earliest) reason = 'lead_time';
    }

    // reserved count
    if (reason === null && reservedCounts) {
      const reserved = reservedCounts.get(startAt.toISOString()) ?? 0;
      if (reserved >= settings.slotCapacity) reason = 'full';
    }

    slots.push({ startAt, reason });
  }

  return { closed: false, closedReason: null, slots };
}

// ─── 単一 pickup_at 検証 (注文作成時) ─────────────────────────────────

export type PickupValidationError =
  | 'pickup_invalid_format'
  | 'pickup_boundary'
  | 'pickup_closed_day'
  | 'pickup_past_lookahead'
  | 'pickup_out_of_hours'
  | 'pickup_lead_time';

export function validatePickupAt(
  pickupAtIso: string,
  settings: PickupSettings,
  now: Date,
): { ok: true; pickupAt: Date } | { ok: false; code: PickupValidationError } {
  // Step 1: format — TZ offset 必須 ('Z' または '+09:00' 等)。
  // offset 無しだと Node のローカル TZ 解釈で JST/UTC 混在のバグを招く。
  if (typeof pickupAtIso !== 'string' || !/([+-]\d{2}:?\d{2}|Z)$/.test(pickupAtIso)) {
    return { ok: false, code: 'pickup_invalid_format' };
  }
  const t = new Date(pickupAtIso);
  if (isNaN(t.getTime())) return { ok: false, code: 'pickup_invalid_format' };

  // t は real UTC Date。JST に +9h シフトして wall-clock 分解する。
  const jstShifted = new Date(t.getTime() + 9 * 60 * 60 * 1000);
  const dateJst = `${jstShifted.getUTCFullYear()}-${String(jstShifted.getUTCMonth() + 1).padStart(2, '0')}-${String(jstShifted.getUTCDate()).padStart(2, '0')}`;
  const hours = jstShifted.getUTCHours();
  const minutes = jstShifted.getUTCMinutes();
  const seconds = jstShifted.getUTCSeconds();
  const totalMin = hours * 60 + minutes;

  // Step 2: 境界 (秒=0 かつ 分が interval の倍数)
  if (seconds !== 0 || totalMin % settings.slotIntervalMin !== 0) {
    return { ok: false, code: 'pickup_boundary' };
  }

  // Step 3: 定休日
  const weekday = jstWeekday(t);
  if (settings.closedWeekdays.includes(weekday)) {
    return { ok: false, code: 'pickup_closed_day' };
  }

  // Step 4: lookahead
  const diff = diffDaysJst(dateJst, now);
  if (diff < 0 || diff >= settings.lookaheadDays) {
    return { ok: false, code: 'pickup_past_lookahead' };
  }

  // Step 5: 営業時間
  const openMin = timeToMinutes(settings.openTime);
  const closeMin = timeToMinutes(settings.closeTime);
  if (totalMin < openMin || totalMin > closeMin - settings.slotIntervalMin) {
    return { ok: false, code: 'pickup_out_of_hours' };
  }

  // Step 6: lead_time (当日のみ)
  if (diff === 0) {
    const earliest = new Date(now.getTime() + settings.leadTimeMin * 60 * 1000);
    if (t < earliest) return { ok: false, code: 'pickup_lead_time' };
  }

  // 正規化: 秒を 0、ミリ秒を 0 に揃えた Date (JST 埋め込み UTC) を返す
  const normalized = jstDateTime(dateJst, totalMin);
  return { ok: true, pickupAt: normalized };
}
