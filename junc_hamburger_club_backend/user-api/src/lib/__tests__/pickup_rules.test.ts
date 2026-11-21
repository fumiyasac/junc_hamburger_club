import {
  generateSlots,
  validatePickupAt,
  jstDateTime,
  toJstDateString,
  diffDaysJst,
  parseClosedWeekdays,
  PickupSettings,
} from '../pickup_rules';

const defaultSettings: PickupSettings = {
  slotIntervalMin: 15,
  slotCapacity: 4,
  leadTimeMin: 20,
  lookaheadDays: 3,
  openTime: '11:00:00',
  closeTime: '21:00:00',
  closedWeekdays: [],
};

// JST の wall-clock 時刻を指す "real UTC Date" を作る (now 引数の形)
function jstReal(dateStr: string, hhmm: string): Date {
  return new Date(dateStr + 'T' + hhmm + ':00+09:00');
}

// JST 埋め込み UTC Date を作る (jstDateTime の結果と同形、startAt 比較用)
function jstEmbed(dateStr: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return jstDateTime(dateStr, h * 60 + m);
}

describe('parseClosedWeekdays', () => {
  test('空文字は空配列', () => {
    expect(parseClosedWeekdays('')).toEqual([]);
  });
  test('"0,6" → [0, 6]', () => {
    expect(parseClosedWeekdays('0,6')).toEqual([0, 6]);
  });
  test('空白と範囲外を除外', () => {
    expect(parseClosedWeekdays('0, 7, abc, 3')).toEqual([0, 3]);
  });
});

describe('toJstDateString / jstDateTime 相互', () => {
  test('jstDateTime 出力を toJstDateString に渡すと元の日付', () => {
    const d = jstEmbed('2026-11-16', '11:00');
    expect(toJstDateString(d)).toBe('2026-11-16');
  });
  test('JST 00:00 の埋め込みでも同じ日付が返る', () => {
    const jstMidnight = jstEmbed('2026-11-16', '00:00');
    expect(toJstDateString(jstMidnight)).toBe('2026-11-16');
  });
});

describe('diffDaysJst', () => {
  test('同日は 0', () => {
    expect(diffDaysJst('2026-11-16', jstReal('2026-11-16', '15:00'))).toBe(0);
  });
  test('翌日は 1', () => {
    expect(diffDaysJst('2026-11-17', jstReal('2026-11-16', '23:30'))).toBe(1);
  });
  test('昨日は -1', () => {
    expect(diffDaysJst('2026-11-15', jstReal('2026-11-16', '00:30'))).toBe(-1);
  });
});

describe('generateSlots - 境界値', () => {
  test('定休日は closed_weekday で slots 空', () => {
    const r = generateSlots('2026-11-16', { ...defaultSettings, closedWeekdays: [1] /* Mon */ }, jstReal('2026-11-16', '10:00'));
    expect(r.closed).toBe(true);
    expect(r.closedReason).toBe('closed_weekday');
    expect(r.slots).toHaveLength(0);
  });

  test('過去日は past', () => {
    const r = generateSlots('2026-11-15', defaultSettings, jstReal('2026-11-16', '10:00'));
    expect(r.closedReason).toBe('past');
  });

  test('lookahead 3 日: today+3 は past_lookahead', () => {
    const r = generateSlots('2026-11-19', defaultSettings, jstReal('2026-11-16', '10:00'));
    expect(r.closedReason).toBe('past_lookahead');
  });

  test('lookahead 3 日: today+2 は OK', () => {
    const r = generateSlots('2026-11-18', defaultSettings, jstReal('2026-11-16', '10:00'));
    expect(r.closed).toBe(false);
  });

  test('枠の列挙は 11:00 から 20:45 まで (40 枠)', () => {
    const r = generateSlots('2026-11-16', defaultSettings, jstReal('2026-11-16', '09:00'));
    expect(r.slots.length).toBe(40);
    // 最初と最後の startAt
    expect(r.slots[0].startAt.toISOString()).toBe(jstEmbed('2026-11-16', '11:00').toISOString());
    expect(r.slots[r.slots.length - 1].startAt.toISOString()).toBe(jstEmbed('2026-11-16', '20:45').toISOString());
  });

  test('close_time ちょうど (21:00) は枠に含まれない', () => {
    const r = generateSlots('2026-11-16', defaultSettings, jstReal('2026-11-16', '09:00'));
    const has21 = r.slots.some((s) => s.startAt.toISOString() === jstEmbed('2026-11-16', '21:00').toISOString());
    expect(has21).toBe(false);
  });

  test('当日 now=11:40 → 11:00/11:15/11:30/11:45/12:00 のうち 11:45 まで lead_time', () => {
    // 11:40 + 20min = 12:00、startAt < 12:00 は lead_time
    const r = generateSlots('2026-11-16', defaultSettings, jstReal('2026-11-16', '11:40'));
    const findReason = (hhmm: string) =>
      r.slots.find((s) => s.startAt.toISOString() === jstEmbed('2026-11-16', hhmm).toISOString())?.reason;
    expect(findReason('11:00')).toBe('lead_time');
    expect(findReason('11:45')).toBe('lead_time');
    expect(findReason('12:00')).toBe(null);
  });

  test('翌日の枠は lead_time を無視して available', () => {
    const r = generateSlots('2026-11-17', defaultSettings, jstReal('2026-11-16', '23:50'));
    expect(r.slots[0].reason).toBeNull();
  });

  test('reservedCounts で full を付与', () => {
    const map = new Map<string, number>();
    map.set(jstEmbed('2026-11-16', '12:00').toISOString(), 4);
    const r = generateSlots('2026-11-16', defaultSettings, jstReal('2026-11-16', '09:00'), map);
    const slot12 = r.slots.find((s) => s.startAt.toISOString() === jstEmbed('2026-11-16', '12:00').toISOString());
    expect(slot12?.reason).toBe('full');
  });
});

describe('validatePickupAt - 境界値', () => {
  const now = jstReal('2026-11-16', '10:00');

  test('不正な ISO 文字列', () => {
    const r = validatePickupAt('not-iso', defaultSettings, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PICKUP_INVALID_FORMAT');
  });

  test('分が 15 刻みでない (11:07)', () => {
    const r = validatePickupAt('2026-11-16T11:07:00+09:00', defaultSettings, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PICKUP_BOUNDARY');
  });

  test('定休日', () => {
    const r = validatePickupAt(
      '2026-11-16T12:00:00+09:00',
      { ...defaultSettings, closedWeekdays: [1] },
      now,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PICKUP_CLOSED_DAY');
  });

  test('lookahead 超過', () => {
    const r = validatePickupAt('2026-11-19T12:00:00+09:00', defaultSettings, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PICKUP_PAST_LOOKAHEAD');
  });

  test('営業時間外 (10:00)', () => {
    const r = validatePickupAt('2026-11-16T10:00:00+09:00', defaultSettings, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PICKUP_OUT_OF_HOURS');
  });

  test('close_time ちょうど (21:00) は out_of_hours', () => {
    const r = validatePickupAt('2026-11-16T21:00:00+09:00', defaultSettings, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PICKUP_OUT_OF_HOURS');
  });

  test('close_time - interval (20:45) は OK', () => {
    const r = validatePickupAt('2026-11-16T20:45:00+09:00', defaultSettings, now);
    expect(r.ok).toBe(true);
  });

  test('lead_time ちょうど (now=10:00 + 20min = 10:20、11:00 枠は OK)', () => {
    const r = validatePickupAt('2026-11-16T11:00:00+09:00', defaultSettings, jstReal('2026-11-16', '10:00'));
    expect(r.ok).toBe(true);
  });

  test('lead_time 内 (now=10:50、11:00 枠は NG)', () => {
    const r = validatePickupAt('2026-11-16T11:00:00+09:00', defaultSettings, jstReal('2026-11-16', '10:50'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PICKUP_LEAD_TIME');
  });

  test('正常系で normalized Date を返す', () => {
    const r = validatePickupAt('2026-11-16T12:00:00+09:00', defaultSettings, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pickupAt.toISOString()).toBe(jstEmbed('2026-11-16', '12:00').toISOString());
    }
  });
});
