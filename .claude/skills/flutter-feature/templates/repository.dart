// lib/data/repositories/<entity>_repository.dart
//
// 3 層構成の雛形:
//   (1) 抽象 Repository     — 本ファイル (インターフェース)
//   (2) Api 実装           — <entity>_api_repository.dart (Dio で user-api 叩く)
//   (3) Mock 実装          — <entity>_mock_repository.dart (mock_data.dart)
//
// Provider で USE_MOCK (dart-define) により 2/3 のどちらを選ぶかを決める。
// 実 API 側の Dio Interceptor / ApiException / Idempotency-Key 等の配線は
// flutter-api-integration Skill のテンプレートに揃える。

import '../models/review.dart';

abstract class ReviewRepository {
  Future<List<Review>> getReviews({String? burgerId});
  Future<Review?> getReviewById(String id);
  Future<Review> createReview({
    required String userId,
    required String burgerId,
    required int rating,
    String? comment,
  });
}

// -----------------------------------------------------------------------------
// 以下は <entity>_api_repository.dart の雛形 (実際は別ファイルに切り出す)
//
// import 'package:dio/dio.dart';
// import '../../core/services/api_client.dart';
// import '../../core/services/api_exception.dart';
//
// class ApiReviewRepository implements ReviewRepository {
//   final ApiClient _client;
//   ApiReviewRepository(this._client);
//
//   @override
//   Future<List<Review>> getReviews({String? burgerId}) async {
//     try {
//       final res = await _client.get<Map<String, dynamic>>(
//         '/reviews',
//         queryParameters: burgerId == null ? null : {'burgerId': burgerId},
//       );
//       final data = res.data!['data'] as Map<String, dynamic>;
//       final items = data['reviews'] as List;
//       return items.map((j) => Review.fromJson(j as Map<String, dynamic>)).toList();
//     } on DioException catch (e) {
//       throw mapDioException(e);  // flutter-api-integration の error_mapping.dart
//     }
//   }
//
//   // ... create / getById も同様
// }

// -----------------------------------------------------------------------------
// 以下は <entity>_mock_repository.dart の雛形 (実際は別ファイルに切り出す)
//
// import 'dart:async';
//
// class MockReviewRepository implements ReviewRepository {
//   final List<Review> _reviews = [];  // インメモリ
//
//   @override
//   Future<List<Review>> getReviews({String? burgerId}) async {
//     await Future.delayed(const Duration(milliseconds: 400));
//     if (burgerId == null) return List.unmodifiable(_reviews);
//     return _reviews.where((r) => r.burgerId == burgerId).toList();
//   }
//
//   @override
//   Future<Review?> getReviewById(String id) async {
//     await Future.delayed(const Duration(milliseconds: 200));
//     try {
//       return _reviews.firstWhere((r) => r.id == id);
//     } catch (_) {
//       return null;
//     }
//   }
//
//   @override
//   Future<Review> createReview({
//     required String userId,
//     required String burgerId,
//     required int rating,
//     String? comment,
//   }) async {
//     await Future.delayed(const Duration(milliseconds: 600));
//     final review = Review(
//       id: DateTime.now().millisecondsSinceEpoch.toString(),
//       userId: userId,
//       burgerId: burgerId,
//       rating: rating,
//       comment: comment,
//       createdAt: DateTime.now(),
//     );
//     _reviews.add(review);
//     return review;
//   }
// }

// -----------------------------------------------------------------------------
// Provider (lib/providers/providers.dart) に以下を追加:
//
// final reviewRepositoryProvider = Provider<ReviewRepository>((ref) {
//   const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: false);
//   if (useMock) return MockReviewRepository();
//   return ApiReviewRepository(ref.read(apiClientProvider));
// });
