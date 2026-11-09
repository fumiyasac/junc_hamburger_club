// lib/viewmodels/<feature>_viewmodel.dart
//
// 2 パターンの ViewModel 雛形:
//   (A) 非同期データ取得 → AsyncNotifier + AsyncNotifierProvider
//   (B) 同期的な UI 状態     → Notifier + NotifierProvider
//
// 重要:
// - @riverpod / build_runner は使わない (全て手動で Provider を宣言)
// - State クラスは immutable + copyWith を手書き (freezed 禁止)
// - state.valueOrNull は Riverpod 3.x で削除済み。state.value を使う
// - AsyncNotifier.build() 内で AsyncValue.guard を呼ばない (再帰になる)

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/review.dart';
import '../providers/providers.dart';

// =====================================================================
// (A) 非同期データ取得パターン: バーガーに紐づくレビュー一覧
// =====================================================================

class ReviewListState {
  final List<Review> reviews;

  const ReviewListState({this.reviews = const []});

  ReviewListState copyWith({List<Review>? reviews}) =>
      ReviewListState(reviews: reviews ?? this.reviews);
}

final reviewListViewModelProvider =
    AsyncNotifierProvider.family<ReviewListViewModel, ReviewListState, String>(
  ReviewListViewModel.new,
);

class ReviewListViewModel
    extends FamilyAsyncNotifier<ReviewListState, String> {
  @override
  Future<ReviewListState> build(String burgerId) async {
    final repo = ref.read(reviewRepositoryProvider);
    final reviews = await repo.getReviews(burgerId: burgerId);
    return ReviewListState(reviews: reviews);
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    // build() を直接呼び直す。guard はここで使う (build() 内では禁止)。
    state = await AsyncValue.guard(() => build(arg));
  }
}

// =====================================================================
// (B) 同期的 UI 状態パターン: レビュー投稿フォーム
// =====================================================================

class ReviewFormState {
  final int rating;
  final String comment;
  final bool isSubmitting;
  final String? error;

  const ReviewFormState({
    this.rating = 5,
    this.comment = '',
    this.isSubmitting = false,
    this.error,
  });

  ReviewFormState copyWith({
    int? rating,
    String? comment,
    bool? isSubmitting,
    String? error,
    bool clearError = false,
  }) =>
      ReviewFormState(
        rating: rating ?? this.rating,
        comment: comment ?? this.comment,
        isSubmitting: isSubmitting ?? this.isSubmitting,
        error: clearError ? null : (error ?? this.error),
      );
}

final reviewFormViewModelProvider =
    NotifierProvider<ReviewFormViewModel, ReviewFormState>(
  ReviewFormViewModel.new,
);

class ReviewFormViewModel extends Notifier<ReviewFormState> {
  @override
  ReviewFormState build() => const ReviewFormState();

  void setRating(int r) => state = state.copyWith(rating: r);
  void setComment(String c) => state = state.copyWith(comment: c);

  Future<Review?> submit({required String userId, required String burgerId}) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final review = await ref.read(reviewRepositoryProvider).createReview(
            userId: userId,
            burgerId: burgerId,
            rating: state.rating,
            comment: state.comment.isEmpty ? null : state.comment,
          );
      state = const ReviewFormState(); // 送信成功でリセット
      return review;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, error: e.toString());
      return null;
    }
  }
}
