// 選択オプション (トッピング) の純粋関数ロジック。
// 正本は docs/options_rules.md。本ファイルと admin-api/options/rules.go はその仕様を
// 忠実に実装する。

import { createHash } from 'crypto';

// ─── 型 ──────────────────────────────────────────────────────────────

export interface OptionDef {
  id: number;
  groupId: number;
  name: string;
  priceDelta: number;    // >= 0
  isAvailable: boolean;
}

export interface OptionGroupDef {
  id: number;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
}

export type ValidationCode =
  | 'option_not_found'
  | 'option_invalid_burger'
  | 'option_group_required'
  | 'option_group_min_violation'
  | 'option_group_max_violation'
  | 'option_out_of_stock';

export interface ValidationError {
  ok: false;
  code: ValidationCode;
  details: {
    groupId?: string;
    groupName?: string;
    optionId?: string;
    optionName?: string;
  };
}

export type ValidationResult =
  | { ok: true; uniqueOptionIds: number[] }
  | ValidationError;

// ─── hash ────────────────────────────────────────────────────────────

/**
 * 選択 option id の決定論的ハッシュ。
 * - 数値昇順ソート + 重複除去 + CSV + SHA-256 (hex 64 文字)
 * - 空配列は空文字 ""
 */
export function computeOptionHash(ids: number[]): string {
  const uniq = Array.from(new Set(ids)).sort((a, b) => a - b);
  if (uniq.length === 0) return '';
  return createHash('sha256').update(uniq.join(',')).digest('hex');
}

// ─── 検証 ────────────────────────────────────────────────────────────

/**
 * カート追加時の検証。
 * - burger に紐付くグループ ID 集合 (allowedGroupIds) と
 *   全オプション (allOptions) と全グループ (allGroups) を渡す。
 * - selectedIds は重複可、内部で一意化する。
 */
export function validateOptionSelection(params: {
  selectedIds: number[];
  allowedGroupIds: Set<number>;
  allOptions: Map<number, OptionDef>;
  allGroups: Map<number, OptionGroupDef>;
}): ValidationResult {
  const { selectedIds, allowedGroupIds, allOptions, allGroups } = params;

  // 重複除去
  const uniqueIds = Array.from(new Set(selectedIds)).sort((a, b) => a - b);

  // (1) 全ての option_id が存在する
  for (const id of uniqueIds) {
    if (!allOptions.has(id)) {
      return { ok: false, code: 'option_not_found', details: { optionId: String(id) } };
    }
  }

  // (2) 所属グループがこのバーガーに適用されている
  for (const id of uniqueIds) {
    const opt = allOptions.get(id)!;
    if (!allowedGroupIds.has(opt.groupId)) {
      return {
        ok: false,
        code: 'option_invalid_burger',
        details: { optionId: String(id), optionName: opt.name, groupId: String(opt.groupId) },
      };
    }
  }

  // グループ別の選択数を集計
  const countByGroup = new Map<number, number>();
  for (const id of uniqueIds) {
    const opt = allOptions.get(id)!;
    countByGroup.set(opt.groupId, (countByGroup.get(opt.groupId) ?? 0) + 1);
  }

  // (3) 必須グループ (allowed かつ isRequired=true) が未選択でないか
  for (const groupId of allowedGroupIds) {
    const g = allGroups.get(groupId);
    if (!g || !g.isRequired) continue;
    if ((countByGroup.get(groupId) ?? 0) === 0) {
      return { ok: false, code: 'option_group_required', details: { groupId: String(groupId), groupName: g.name } };
    }
  }

  // (4)(5) min/max
  for (const [groupId, count] of countByGroup.entries()) {
    const g = allGroups.get(groupId)!;
    if (count < g.minSelect) {
      return {
        ok: false,
        code: 'option_group_min_violation',
        details: { groupId: String(groupId), groupName: g.name },
      };
    }
    if (count > g.maxSelect) {
      return {
        ok: false,
        code: 'option_group_max_violation',
        details: { groupId: String(groupId), groupName: g.name },
      };
    }
  }

  // (6) 売り切れチェック
  for (const id of uniqueIds) {
    const opt = allOptions.get(id)!;
    if (!opt.isAvailable) {
      return {
        ok: false,
        code: 'option_out_of_stock',
        details: { optionId: String(id), optionName: opt.name },
      };
    }
  }

  return { ok: true, uniqueOptionIds: uniqueIds };
}

// ─── 価格計算 ────────────────────────────────────────────────────────

export function computeUnitPrice(burgerPrice: number, selectedOptions: OptionDef[]): number {
  const delta = selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
  return burgerPrice + delta;
}

export function computeSubtotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}
