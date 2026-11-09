// lib/data/repositories/<entity>_repository.dart
//
// abstract + Impl 形式。既存 burger_repository.dart と同じスタイル。
// 現在は全てモック駆動 (CLAUDE.md "既知の不一致")。実 API 配線時は Impl を差し替える。

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

class ReviewRepositoryImpl implements ReviewRepository {
  // モック用インメモリ
  final List<Review> _reviews = [];

  @override
  Future<List<Review>> getReviews({String? burgerId}) async {
    await Future.delayed(const Duration(milliseconds: 400));
    if (burgerId == null) return List.unmodifiable(_reviews);
    return _reviews.where((r) => r.burgerId == burgerId).toList();
  }

  @override
  Future<Review?> getReviewById(String id) async {
    await Future.delayed(const Duration(milliseconds: 200));
    try {
      return _reviews.firstWhere((r) => r.id == id);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<Review> createReview({
    required String userId,
    required String burgerId,
    required int rating,
    String? comment,
  }) async {
    await Future.delayed(const Duration(milliseconds: 600));
    final review = Review(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: userId,
      burgerId: burgerId,
      rating: rating,
      comment: comment,
      createdAt: DateTime.now(),
    );
    _reviews.add(review);
    return review;
  }
}
