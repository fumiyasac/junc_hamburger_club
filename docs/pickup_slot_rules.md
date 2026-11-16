# 受け取り枠 (Pickup Slot) 計算ルール

受け取り枠の判定・生成ロジックは **User API (TypeScript) と Admin API (Go) の両方に実装されている**。両者がドリフトしないよう、本ドキュメントを**唯一の計算ルール仕様 (正本)** とする。

変更する際は必ず:

1. 本ドキュメントを先に更新
2. `junc_hamburger_club_backend/user-api/src/lib/pickup_rules.ts` を更新
3. `junc_hamburger_club_backend/admin-api/pickup/rules.go` を更新
4. 両側のユニットテスト (`pickup_rules.test.ts` / `rules_test.go`) を更新

---

## 用語

| 名称 | 型 | 意味 |
|---|---|---|
| `slot_interval_min` | int | 枠の間隔 (分)。デフォルト 15 |
| `slot_capacity` | int | 1 枠の定員 (件)。デフォルト 4 |
| `lead_time_min` | int | 現在時刻から見て**これより先の枠**しか選べない (分)。デフォルト 20 |
| `lookahead_days` | int | 当日含めて何日先まで予約可能か。デフォルト 3 (今日 + 2 日後まで) |
| `open_time` | TIME | 店舗の営業開始時刻 (JST)。デフォルト 11:00 |
| `close_time` | TIME | 店舗の営業終了時刻 (JST)。デフォルト 21:00 |
| `closed_weekdays` | CSV | 定休日の曜日 (`0`=日曜 … `6`=土曜)。例: `"0,6"` = 土日休。空文字 = 無休 |

JST = `Asia/Tokyo` 固定。全ての時刻判定は JST 基準で行う。

---

## 枠の生成 (ある日付の slot 一覧)

**入力**: `date` (JST の暦日), `settings`, `now` (現在時刻、JST)

**出力**: `{ closed, closedReason, slots: [{ startAt, available, remaining, reason }] }`

### Step 1. 定休日判定

```
weekday = date の曜日 (0=Sun ... 6=Sat)
if weekday ∈ settings.closed_weekdays:
  return { closed: true, closedReason: 'closed_weekday', slots: [] }
```

### Step 2. 予約可能期間の判定

```
today_jst = now の JST 暦日
diff_days = (date - today_jst) を日単位で
if diff_days < 0:
  return { closed: true, closedReason: 'past', slots: [] }
if diff_days >= settings.lookahead_days:
  return { closed: true, closedReason: 'past_lookahead', slots: [] }
```

(`lookahead_days=3` なら `today + 0, +1, +2` の 3 日ぶんが許容。`today + 3` は past_lookahead)

### Step 3. 枠の列挙

```
cursor = open_time (JST の date 上の時刻)
last = close_time - slot_interval_min   # 最終枠 = close - interval ぶん手前
slots = []
while cursor <= last:
  slots.push({ time: cursor, reason: null })
  cursor += slot_interval_min
```

例: `open=11:00, close=21:00, interval=15` → `[11:00, 11:15, ..., 20:45]` の 40 枠。

### Step 4. 各枠の選択可否判定

各 slot に対して:

```
startAt = date + slot.time  (JST, 秒は 0)
if slot と今日の暦日が同じ and startAt < now + lead_time_min:
  reason = 'lead_time'
```

(他日はリードタイム判定不要 — 翌日以降の枠は現在時刻から常に lead_time 以上離れているため)

```
else if slot_at > now + lookahead_days * 24h:
  # Step 2 で date 全体を弾いているため通常は発生しない。保険として残す
  reason = 'past_lookahead'
```

### Step 5. 残数の付与

```
for slot in slots:
  reserved = pickup_slot_counters から (store_id=1, slot_at=startAt) を参照 (無ければ 0)
  remaining = settings.slot_capacity - reserved
  available = (slot.reason == null) and (remaining > 0)
  if slot.reason == null and remaining <= 0:
    slot.reason = 'full'
```

---

## 注文作成時の pickup_at 検証

ユーザーが指定する `pickupAt` (ISO 8601 文字列、タイムゾーンオフセット付き) を以下の順で検証する。**失敗した最初のチェックで対応するエラーコードを返して停止**する。

| # | チェック | 失敗時のエラーコード | HTTP |
|---|---|---|---|
| 1 | `pickupAt` が ISO 8601 として parse できる | `pickup_invalid_format` | 400 |
| 2 | JST に正規化した時刻の秒が 0、かつ分が `slot_interval_min` の倍数 | `pickup_boundary` | 400 |
| 3 | JST 暦日が定休日でない | `pickup_closed_day` | 400 |
| 4 | JST 暦日が `[today, today + lookahead_days)` の範囲内 | `pickup_past_lookahead` | 400 |
| 5 | `open_time <= 時刻 <= close_time - slot_interval_min` | `pickup_out_of_hours` | 400 |
| 6 | `startAt >= now + lead_time_min` (当日のみ判定) | `pickup_lead_time` | 400 |
| 7 | `pickup_slot_counters.reserved_count < slot_capacity` (トランザクション内で SELECT ... FOR UPDATE) | `pickup_slot_full` | 409 |

### 同時実行制御 (トランザクション内)

```
BEGIN
  # pickup_slot_counters から対象行を FOR UPDATE で取得
  SELECT reserved_count FROM pickup_slot_counters
    WHERE store_id = 1 AND slot_at = ? FOR UPDATE

  # 存在しない場合は INSERT (reserved_count = 0)
  if not found:
    INSERT INTO pickup_slot_counters (store_id, slot_at, reserved_count) VALUES (1, ?, 0)
    SELECT reserved_count ... FOR UPDATE   # もう一度取得

  if reserved_count >= slot_capacity:
    ROLLBACK
    return 409 pickup_slot_full

  UPDATE pickup_slot_counters SET reserved_count = reserved_count + 1
    WHERE store_id = 1 AND slot_at = ?

  INSERT INTO orders (..., pickup_at) VALUES (...)
  INSERT INTO order_items ...
  DELETE FROM cart_items ...
COMMIT
```

### キャンセル時の減算

`PUT /api/v1/orders/:orderId/cancel` でキャンセルされた注文に `pickup_at` が入っていた場合、同一トランザクション内で:

```
UPDATE pickup_slot_counters
  SET reserved_count = GREATEST(reserved_count - 1, 0)
  WHERE store_id = 1 AND slot_at = (キャンセル対象 order.pickup_at)
```

`GREATEST(..., 0)` はカウンタの不整合 (負値) に対する防御。

---

## 境界値のテスト仕様

以下のケースは `pickup_rules.test.ts` / `rules_test.go` の両方でカバーすること:

| # | 条件 | 期待 |
|---|---|---|
| 1 | 今日 11:00、now = 10:00 | lead_time=20 なので 11:00 は `lead_time` (10:00 + 20min = 10:20 < 11:00 OK → 10:40 以降の枠選択可) |
| 2 | 今日 11:00、now = 11:40 | 11:40 + 20min = 12:00、11:00/11:15/11:30/11:45 すべて `lead_time`、12:00 以降 OK |
| 3 | 今日 20:45 の枠、now = 15:00 | 営業時間内の最終枠。available = true |
| 4 | 今日 21:00 の枠 | **枠に含まれない** (close_time 自体は枠開始に使わない、枠列挙は `[open, close - interval]`) |
| 5 | 翌日 11:00 の枠、now = 23:50 | lead_time 判定は same-day のみ、available = true |
| 6 | `date = today + lookahead_days` | `past_lookahead` |
| 7 | `date = today - 1` | `past` |
| 8 | 定休日が `[0, 6]` で指定日が日曜 | `closed_weekday` |
| 9 | 分が 15 刻みでない (例: 11:07) で POST 注文 | `pickup_boundary` |
| 10 | capacity=4 の枠に 4 件既に予約済みで POST | `pickup_slot_full` (409) |

---

## 参考実装

- TypeScript: `junc_hamburger_club_backend/user-api/src/lib/pickup_rules.ts`
- Go: `junc_hamburger_club_backend/admin-api/pickup/rules.go`

両者はこの仕様に準拠しているか必ずユニットテストで検証する。差異が疑われた場合は本ドキュメントを正本として両コードを修正する。
