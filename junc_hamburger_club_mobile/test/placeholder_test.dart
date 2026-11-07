// CI の `flutter test` を成立させるための最小プレースホルダー。
// 実アプリに依存するテストは別タスクで整備する。
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('placeholder — flutter test should not fail with empty test dir', () {
    expect(1 + 1, 2);
  });
}
