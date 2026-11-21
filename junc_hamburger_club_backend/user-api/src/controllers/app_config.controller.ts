// 公開 アプリ設定 API: GET /api/v1/app-config
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AppError } from '../lib/errors';

interface AppConfigRow {
  maintenance_mode: number;
  maintenance_message: string | null;
  ios_min_version: string;
  ios_latest_version: string;
  android_min_version: string;
  android_latest_version: string;
}

export async function getAppConfig(_req: Request, res: Response): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT maintenance_mode, maintenance_message,
            ios_min_version, ios_latest_version,
            android_min_version, android_latest_version
     FROM app_config WHERE id = 1`,
  );
  if (rows.length === 0) {
    throw new AppError('APP_CONFIG_NOT_FOUND', 'アプリ設定が初期化されていません', 500);
  }
  const row = rows[0] as AppConfigRow;
  // メンテナンスモード切替を即時反映できるようキャッシュ禁止
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      maintenance: {
        enabled: Boolean(row.maintenance_mode),
        message: row.maintenance_message,
      },
      ios: { minVersion: row.ios_min_version, latestVersion: row.ios_latest_version },
      android: { minVersion: row.android_min_version, latestVersion: row.android_latest_version },
    },
  });
}
