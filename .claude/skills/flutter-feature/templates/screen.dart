// lib/presentation/screens/<feature>/<name>_screen.dart
//
// ConsumerWidget を基本とし、AsyncNotifier の結果は state.when で捌く。
// 色は AppColors の定数経由。hex ハードコード禁止。

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../viewmodels/review_viewmodel.dart';

class ReviewListScreen extends ConsumerWidget {
  final String burgerId;

  const ReviewListScreen({super.key, required this.burgerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(reviewListViewModelProvider(burgerId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('レビュー')),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('😅', style: TextStyle(fontSize: 48)),
              const SizedBox(height: 12),
              Text('読み込みに失敗: $err'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => ref
                    .read(reviewListViewModelProvider(burgerId).notifier)
                    .refresh(),
                child: const Text('再試行'),
              ),
            ],
          ),
        ),
        data: (s) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () => ref
              .read(reviewListViewModelProvider(burgerId).notifier)
              .refresh(),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: s.reviews.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final r = s.reviews[i];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('★ ${r.rating}',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    if (r.comment != null) Text(r.comment!),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
