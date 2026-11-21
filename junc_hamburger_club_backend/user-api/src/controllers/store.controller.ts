// 公開 店舗情報 API: GET /api/v1/store
// 営業時間は pickup_settings を正とし、曜日別の open/close は全曜日同じ時刻で返す

import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { PickupSettingsRow } from '../types';
import { settingsFromRow } from '../lib/pickup_rules';
import { AppError } from '../lib/errors';

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const WEEKDAY_ORDER: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

type DayStatus = 'OPEN' | 'OUTSIDE_HOURS' | 'CLOSED_DAY';

function hmToMinutes(hms: string): number {
  const [h, m] = hms.split(':').map(Number);
  return h * 60 + m;
}

export async function getStore(_req: Request, res: Response): Promise<void> {
  const name = process.env.STORE_NAME;
  const address = process.env.STORE_ADDRESS;
  const phone = process.env.STORE_PHONE;
  if (!name || !address || !phone) {
    throw new AppError('STORE_PROFILE_MISSING', '店舗プロフィールが設定されていません', 500);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM pickup_settings WHERE store_id = 1',
  );
  if (rows.length === 0) {
    throw new AppError('APP_CONFIG_NOT_FOUND', '受け取り枠設定が初期化されていません', 500);
  }
  const settings = settingsFromRow(rows[0] as PickupSettingsRow);

  // HH:MM:SS → HH:MM
  const open = settings.openTime.slice(0, 5);
  const close = settings.closeTime.slice(0, 5);
  const closedWeekdays = settings.closedWeekdays;
  const closedSet = new Set(closedWeekdays);

  const openingHours: Record<Weekday, { open: string; close: string } | null> = {
    sun: null, mon: null, tue: null, wed: null, thu: null, fri: null, sat: null,
  };
  WEEKDAY_ORDER.forEach((wd, idx) => {
    openingHours[wd] = closedSet.has(idx) ? null : { open, close };
  });

  // JST 現在時刻での営業状態
  const now = new Date();
  const jstOffsetMin = 9 * 60;
  const localNow = new Date(now.getTime() + (jstOffsetMin + now.getTimezoneOffset()) * 60 * 1000);
  const weekday = localNow.getDay();
  const minutes = localNow.getHours() * 60 + localNow.getMinutes();

  let todayStatus: DayStatus;
  if (closedSet.has(weekday)) {
    todayStatus = 'CLOSED_DAY';
  } else if (minutes < hmToMinutes(open) || minutes >= hmToMinutes(close)) {
    todayStatus = 'OUTSIDE_HOURS';
  } else {
    todayStatus = 'OPEN';
  }

  // 営業時間変更の即時性より負荷軽減を優先し、短期キャッシュ
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    success: true,
    data: {
      name,
      address,
      phone,
      openingHours,
      closedWeekdays,
      todayStatus,
    },
  });
}
