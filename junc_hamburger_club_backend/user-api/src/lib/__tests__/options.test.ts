import {
  computeOptionHash,
  computeUnitPrice,
  computeSubtotal,
  validateOptionSelection,
  OptionDef,
  OptionGroupDef,
} from '../options';

// サンプルデータ
const groups = new Map<number, OptionGroupDef>([
  [1, { id: 1, name: 'パティ', isRequired: true, minSelect: 1, maxSelect: 1 }],
  [2, { id: 2, name: 'トッピング', isRequired: false, minSelect: 0, maxSelect: 3 }],
  [3, { id: 3, name: 'バンズ', isRequired: false, minSelect: 0, maxSelect: 1 }],
]);

const options = new Map<number, OptionDef>([
  [1, { id: 1, groupId: 1, name: 'シングル', priceDelta: 0, isAvailable: true }],
  [2, { id: 2, groupId: 1, name: 'ダブル', priceDelta: 600, isAvailable: true }],
  [3, { id: 3, groupId: 2, name: 'チーズ', priceDelta: 150, isAvailable: true }],
  [4, { id: 4, groupId: 2, name: 'ベーコン', priceDelta: 200, isAvailable: true }],
  [5, { id: 5, groupId: 2, name: 'アボカド', priceDelta: 250, isAvailable: false }],
  [12, { id: 12, groupId: 3, name: 'ブリオッシュ', priceDelta: 0, isAvailable: true }],
  [13, { id: 13, groupId: 3, name: '全粒粉', priceDelta: 100, isAvailable: true }],
  // group 99 = バーガーに紐付かないグループ
  [99, { id: 99, groupId: 99, name: '関係ないオプション', priceDelta: 50, isAvailable: true }],
]);

const allowed = new Set<number>([1, 2, 3]); // パティ・トッピング・バンズ

describe('computeOptionHash', () => {
  test('空配列は空文字', () => {
    expect(computeOptionHash([])).toBe('');
  });
  test('重複を含む同じ集合 → 同じ hash', () => {
    const a = computeOptionHash([3, 6, 12]);
    const b = computeOptionHash([12, 6, 3, 6]);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
  test('違う集合 → 違う hash', () => {
    expect(computeOptionHash([3, 6])).not.toBe(computeOptionHash([3, 7]));
  });
});

describe('computeUnitPrice / computeSubtotal', () => {
  test('オプションなし → burger.price のまま', () => {
    expect(computeUnitPrice(980, [])).toBe(980);
  });
  test('price_delta=0 のみ → burger.price のまま', () => {
    const opts = [options.get(1)!, options.get(12)!];
    expect(computeUnitPrice(980, opts)).toBe(980);
  });
  test('差分合算', () => {
    const opts = [options.get(2)!, options.get(3)!, options.get(13)!];
    expect(computeUnitPrice(980, opts)).toBe(980 + 600 + 150 + 100);
  });
  test('subtotal = unit * qty', () => {
    expect(computeSubtotal(1500, 3)).toBe(4500);
  });
});

describe('validateOptionSelection - 境界値', () => {
  test('空配列 + 必須グループあり → option_group_required', () => {
    const r = validateOptionSelection({
      selectedIds: [],
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('option_group_required');
      expect(r.details.groupName).toBe('パティ');
    }
  });

  test('空配列 + 必須グループなし → OK', () => {
    const r = validateOptionSelection({
      selectedIds: [],
      allowedGroupIds: new Set([2, 3]), // 任意のみ
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(true);
  });

  test('必須単一 (min=1,max=1) で同じ ID を 2 個 → 重複除去で OK', () => {
    const r = validateOptionSelection({
      selectedIds: [1, 1],
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.uniqueOptionIds).toEqual([1]);
  });

  test('必須単一で 2 種類送る → max_violation', () => {
    const r = validateOptionSelection({
      selectedIds: [1, 2],
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('option_group_max_violation');
  });

  test('トッピング最大 3 の境界: 3 個 OK / 4 個 NG', () => {
    const r3 = validateOptionSelection({
      selectedIds: [1, 3, 4, 6], // パティ1件 + トッピング3件 (optionId 6 を追加)
      allowedGroupIds: allowed,
      allOptions: new Map([
        ...options,
        [6, { id: 6, groupId: 2, name: '目玉焼き', priceDelta: 150, isAvailable: true }],
      ]),
      allGroups: groups,
    });
    expect(r3.ok).toBe(true);

    const r4 = validateOptionSelection({
      selectedIds: [1, 3, 4, 6, 7],
      allowedGroupIds: allowed,
      allOptions: new Map([
        ...options,
        [6, { id: 6, groupId: 2, name: '目玉焼き', priceDelta: 150, isAvailable: true }],
        [7, { id: 7, groupId: 2, name: 'ハラペーニョ', priceDelta: 100, isAvailable: true }],
      ]),
      allGroups: groups,
    });
    expect(r4.ok).toBe(false);
    if (!r4.ok) expect(r4.code).toBe('option_group_max_violation');
  });

  test('対象バーガーに紐付かないグループ → option_invalid_burger', () => {
    const r = validateOptionSelection({
      selectedIds: [1, 99],
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('option_invalid_burger');
  });

  test('存在しない option_id → option_not_found', () => {
    const r = validateOptionSelection({
      selectedIds: [1, 9999],
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('option_not_found');
  });

  test('売り切れオプション → option_out_of_stock', () => {
    const r = validateOptionSelection({
      selectedIds: [1, 5], // 5=アボカド (is_available=false)
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('option_out_of_stock');
  });

  test('バンズ変更 max=1 の境界: 2 個送る → max_violation', () => {
    const r = validateOptionSelection({
      selectedIds: [1, 12, 13],
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('option_group_max_violation');
  });

  test('正常: パティ + トッピング 2 + バンズ', () => {
    const r = validateOptionSelection({
      selectedIds: [2, 3, 4, 13],
      allowedGroupIds: allowed,
      allOptions: options,
      allGroups: groups,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.uniqueOptionIds).toEqual([2, 3, 4, 13]);
  });
});
