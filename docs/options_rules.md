# トッピング・オプション (options) の計算 / 検証ルール

本ドキュメントはオプション周りの **唯一のルール仕様 (正本)**。user-api (TS) と admin-api (Go) の両実装はこの仕様に準拠し、差異がある場合は本ドキュメントを修正源として両コードを揃える。

関連実装:

- TS: `junc_hamburger_club_backend/user-api/src/lib/options.ts` + `__tests__/options.test.ts`
- Go: `junc_hamburger_club_backend/admin-api/options/rules.go` (admin 側はバリデーションのみ、価格計算は user-api で完結)

## 1. データ構造

| エンティティ | 要点 |
|---|---|
| `option_groups` | 1 つの選択単位 (例: "パティ")。`is_required`, `min_select`, `max_select`, `display_order` |
| `options` | 具体的な選択肢 (例: "ダブル +600 円")。`group_id`, `price_delta DECIMAL(10,2) >=0`, `is_available`, `display_order` |
| `burger_option_groups` | バーガーごとに適用するグループを限定する M:N |
| `cart_items.option_hash` | 選択オプション組み合わせの決定論的ハッシュ。UNIQUE (`user_id`, `burger_id`, `option_hash`) |
| `cart_item_options` | 表示・クエリ用の中間テーブル |
| `order_item_options` | 注文時のスナップショット (name / price_delta を保存、option_id は NULL 可) |

## 2. option_hash の生成

**決定論的に** 以下の手順で生成する:

```
1. selectedOptionIds を数値昇順ソート
2. 重複除去 (同一 ID は 1 回だけ)
3. "," で連結 (例: "3,6,12")
4. SHA-256 → 16 進 64 文字
```

空配列 (オプションなし) は `""` (空文字) とする (hash を計算しない)。

この hash を使った UNIQUE KEY で "同じ組み合わせ" を O(1) で判定する。

## 3. 価格計算

全ての価格計算は **サーバー側** で行う。クライアントから送られてきた価格は信用しない。

```
unit_price = burger.price + SUM(options[i].price_delta for i in selectedOptions)
subtotal   = unit_price * quantity
```

price_delta は 0 以上 (負の値は admin-api 側でバリデーション)。計算は DECIMAL で、最終結果を `.toFixed(2)` で保存。

## 4. カート追加時の検証 (`POST /api/v1/cart`)

入力: `{ burgerId, quantity, selectedOptionIds: string[] }`

以下の順で検証し、**最初に失敗したチェックで対応するエラーコード + 400** を返して停止する:

| # | チェック | エラーコード |
|---|---|---|
| 1 | `selectedOptionIds` の各 ID が DB に存在する | `option_not_found` |
| 2 | 各オプションの所属グループが、対象バーガーの `burger_option_groups` に含まれる | `option_invalid_burger` |
| 3 | バーガーに紐づく全ての `is_required=TRUE` グループが、selectedOptionIds に少なくとも 1 件含まれる | `option_group_required` |
| 4 | 各グループに含まれる選択数 ≥ `min_select` | `option_group_min_violation` |
| 5 | 各グループに含まれる選択数 ≤ `max_select` | `option_group_max_violation` |
| 6 | 全オプションの `is_available=TRUE` | `option_out_of_stock` |

同じ option_id の重複指定は上記 (1) の前にサーバー側で**一意化**する (= `Set` で丸める)。これにより `min_select=1` の必須グループに同じ ID を 2 個送っても 1 件とカウントされる。

エラーレスポンスには **どのグループ / どのオプションが原因か** を `details` に含める:

```json
{
  "success": false,
  "error": "Invalid options",
  "code": "option_group_required",
  "details": { "groupId": "1", "groupName": "パティ" }
}
```

## 5. カート更新時の変更ポリシー (`PUT /api/v1/cart/:itemId`)

**オプション変更は非対応**。quantity のみ更新可。

- 理由: option 変更は実質「別組み合わせ」なので、UX は DELETE + POST の方が自然
- クライアントがオプションを変えたいときは、該当 cart_item を DELETE し、新しい組み合わせで POST する

## 6. 注文確定時の再検証 (`POST /api/v1/orders`)

カート確定後に admin が売り切れトグルすることがあり得るため、注文確定時に **売り切れチェックのみ再実行** する:

```
for each cart_item:
  for each option in cart_item_options:
    if option.is_available == FALSE:
      return 400 {
        code: 'option_out_of_stock_at_order',
        itemId: '<cart_item id>',
        optionId: '<option id>',
        optionName: '<option name>'
      }
```

構造的バリデーション (必須・最大最小) は再実行しない。
PR #54 で実装した pickup 枠の FOR UPDATE ロックはそのまま維持し、option 再検証はその tx 内で行う。

## 7. 注文のスナップショット

`order_item_options` には注文時点の `group_name`, `option_name`, `price_delta` を保存する。後で admin が option の name や price を変更しても、過去の注文表示は注文時点の値を保持する。

`option_id` カラムは NULL 許容。元 option が削除されても過去注文の表示は snapshot だけで完結する。

## 8. 一覧 API の扱い

- `GET /api/v1/burgers`: option 情報を **含めない** (一覧のペイロードを肥大化させない)
- `GET /api/v1/burgers/:id`: `optionGroups` を含める

## 9. 境界値のテスト仕様

TS/Go 両実装で以下を網羅する:

| # | 条件 | 期待 |
|---|---|---|
| 1 | selectedOptionIds = [] で、必須グループなし | OK |
| 2 | selectedOptionIds = [] で、必須グループあり | `option_group_required` |
| 3 | 必須単一 (min=1, max=1) で同じ ID を 2 個送る | **OK** (重複除去で 1 件とカウント) |
| 4 | max_select=3 で 4 個送る | `option_group_max_violation` |
| 5 | min_select=1 で 0 個 (任意グループ) | `option_group_min_violation` |
| 6 | 対象バーガーに紐付かないグループのオプション | `option_invalid_burger` |
| 7 | 存在しない option_id | `option_not_found` |
| 8 | is_available=FALSE の option 指定 | `option_out_of_stock` |
| 9 | price_delta=0 のオプションだけ複数 | unit_price = burger.price |
| 10 | hash: 同じ ID 群 (順序違い) → 同じ hash | 一致 |
| 11 | hash: 空配列 → `""` | 一致 |

## 10. admin 側のバリデーション

- `price_delta` < 0 → 400
- `min_select` > `max_select` → 400
- `is_required=TRUE` かつ `min_select=0` → 警告 (許容するが実質 required が機能しない)
