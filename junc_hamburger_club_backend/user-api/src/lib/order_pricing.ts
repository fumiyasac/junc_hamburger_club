// 注文プレビュー + 共通価格計算ロジック。
// createOrder は確定処理 (tx, 枠カウンタ, snapshot) を持つため full 統合は難しいが、
// 価格計算と pickup/オプション検証はここに集約する。

import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { PickupSettingsRow } from '../types';
import {
  settingsFromRow,
  validatePickupAt,
  PickupValidationError,
  PICKUP_VALIDATION_MESSAGES,
} from './pickup_rules';
import { formatJstIso } from '../controllers/pickup.controller';
import { AppError } from './errors';

export interface PreviewOptionSnapshot {
  id: string;        // option master id
  groupName: string;
  name: string;
  priceDelta: number;
}

export interface PreviewItemWarning {
  code: 'BURGER_UNAVAILABLE' | 'OPTION_OUT_OF_STOCK';
  details: Record<string, string>;
}

export interface PreviewItem {
  cartItemId: string;
  burgerId: string;
  burgerName: string;
  burgerImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  options: PreviewOptionSnapshot[];
  warnings: PreviewItemWarning[];
}

export interface PreviewPickup {
  requestedAt: string | null;
  available: boolean;
  unavailableReason: PickupValidationError | 'PICKUP_SLOT_FULL' | null;
  message: string | null;
}

export interface PreviewResponse {
  items: PreviewItem[];
  subtotal: number;
  tax: number;
  total: number;
  pickup: PreviewPickup;
  canPlaceOrder: boolean;
  warnings: PreviewItemWarning[];
}

const TAX_RATE = 0.1;

export async function computePreview(userId: number, pickupAt?: string): Promise<PreviewResponse> {
  // ─── カート取得 (burger 情報付き)
  const [cartRows] = await pool.query<RowDataPacket[]>(
    `SELECT ci.id, ci.burger_id, ci.quantity,
            b.name AS burger_name, b.price AS burger_price,
            b.image_url AS burger_image_url, b.is_available AS burger_is_available
     FROM cart_items ci
     JOIN burgers b ON ci.burger_id = b.id
     WHERE ci.user_id = ?
     ORDER BY ci.created_at`,
    [userId],
  );
  if (cartRows.length === 0) {
    // カート空は例外扱いで 400 (preview でも)
    throw new AppError('CART_EMPTY', 'カートが空です', 400);
  }

  const cartIds = cartRows.map((r) => r['id'] as number);

  // ─── オプション取得
  const [optRows] = await pool.query<RowDataPacket[]>(
    `SELECT cio.cart_item_id, o.id, o.name, o.price_delta, o.is_available, og.name AS group_name
     FROM cart_item_options cio
     JOIN options o ON o.id = cio.option_id
     JOIN option_groups og ON og.id = o.group_id
     WHERE cio.cart_item_id IN (?)
     ORDER BY og.display_order, o.display_order, o.id`,
    [cartIds],
  );

  interface OptRow { id: number; name: string; priceDelta: number; isAvailable: boolean; groupName: string }
  const optsByCart = new Map<number, OptRow[]>();
  for (const r of optRows as RowDataPacket[]) {
    const cid = r['cart_item_id'] as number;
    if (!optsByCart.has(cid)) optsByCart.set(cid, []);
    optsByCart.get(cid)!.push({
      id: r['id'] as number,
      name: r['name'] as string,
      priceDelta: parseFloat(r['price_delta'] as string),
      isAvailable: Boolean(r['is_available']),
      groupName: r['group_name'] as string,
    });
  }

  // ─── 明細組み立て
  const allWarnings: PreviewItemWarning[] = [];
  const items: PreviewItem[] = cartRows.map((row) => {
    const opts = optsByCart.get(row['id'] as number) ?? [];
    const base = parseFloat(row['burger_price'] as string);
    const delta = opts.reduce((s, o) => s + o.priceDelta, 0);
    const unitPrice = base + delta;
    const quantity = row['quantity'] as number;

    const warnings: PreviewItemWarning[] = [];
    if (!row['burger_is_available']) {
      const w: PreviewItemWarning = {
        code: 'BURGER_UNAVAILABLE',
        details: { burgerId: String(row['burger_id']) },
      };
      warnings.push(w);
      allWarnings.push(w);
    }
    for (const o of opts) {
      if (!o.isAvailable) {
        const w: PreviewItemWarning = {
          code: 'OPTION_OUT_OF_STOCK',
          details: { optionId: String(o.id), optionName: o.name, itemId: String(row['id']) },
        };
        warnings.push(w);
        allWarnings.push(w);
      }
    }

    return {
      cartItemId: String(row['id']),
      burgerId: String(row['burger_id']),
      burgerName: row['burger_name'] as string,
      burgerImageUrl: row['burger_image_url'] as string | null,
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity,
      options: opts.map((o) => ({
        id: String(o.id), groupName: o.groupName, name: o.name, priceDelta: o.priceDelta,
      })),
      warnings,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  // ─── pickup 判定
  const pickup: PreviewPickup = { requestedAt: pickupAt ?? null, available: true, unavailableReason: null, message: null };
  if (pickupAt) {
    const [settingsRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM pickup_settings WHERE store_id = 1',
    );
    if (settingsRows.length === 0) {
      throw new AppError('APP_CONFIG_NOT_FOUND', '受け取り枠設定が初期化されていません', 500);
    }
    const settings = settingsFromRow(settingsRows[0] as PickupSettingsRow);
    const validation = validatePickupAt(pickupAt, settings, new Date());
    if (!validation.ok) {
      pickup.available = false;
      pickup.unavailableReason = validation.code;
      pickup.message = PICKUP_VALIDATION_MESSAGES[validation.code];
    } else {
      // 枠カウンタ確認 (満枠か?)
      const slotAt = validation.pickupAt;
      const [counterRows] = await pool.query<RowDataPacket[]>(
        'SELECT reserved_count FROM pickup_slot_counters WHERE store_id = 1 AND slot_at = ?',
        [slotAt],
      );
      const reserved = counterRows.length > 0 ? (counterRows[0] as { reserved_count: number }).reserved_count : 0;
      const [capRows] = await pool.query<RowDataPacket[]>(
        'SELECT slot_capacity FROM pickup_settings WHERE store_id = 1',
      );
      const capacity = (capRows[0] as { slot_capacity: number }).slot_capacity;
      if (reserved >= capacity) {
        pickup.available = false;
        pickup.unavailableReason = 'PICKUP_SLOT_FULL';
        pickup.message = 'この時間帯は予約がいっぱいです';
      } else {
        pickup.requestedAt = formatJstIso(slotAt);
      }
    }
  }

  const canPlaceOrder = allWarnings.length === 0 && pickup.available;

  return { items, subtotal, tax, total, pickup, canPlaceOrder, warnings: allWarnings };
}
