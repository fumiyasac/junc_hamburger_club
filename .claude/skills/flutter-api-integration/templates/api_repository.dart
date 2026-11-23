// lib/data/repositories/<entity>_api_repository.dart
//
// Api 実装の雛形。Dio の呼び出しを ApiClient 経由に揃え、
// DioException は必ず mapDioException で ApiException に変換する。

import 'package:dio/dio.dart';
import '../../core/services/api_client.dart';
import '../../core/services/error_mapping.dart';
import '../models/burger.dart';
import 'burger_repository.dart';

class ApiBurgerRepository implements BurgerRepository {
  final ApiClient _client;
  ApiBurgerRepository(this._client);

  @override
  Future<List<Burger>> getBurgers({String? category}) async {
    try {
      final res = await _client.get<Map<String, dynamic>>(
        '/burgers',
        queryParameters: category == null ? null : {'category': category},
      );
      final data = res.data!['data'] as Map<String, dynamic>;
      final items = data['burgers'] as List;
      return items
          .map((j) => Burger.fromJson(j as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  @override
  Future<Burger> getBurgerById(String id) async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/burgers/$id');
      return Burger.fromJson(res.data!['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

// -----------------------------------------------------------------------------
// Provider (lib/providers/providers.dart):
//
// final burgerRepositoryProvider = Provider<BurgerRepository>((ref) {
//   const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: false);
//   if (useMock) return MockBurgerRepository();
//   return ApiBurgerRepository(ref.read(apiClientProvider));
// });
