import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../viewmodels/cart_viewmodel.dart';
import '../../../viewmodels/search_viewmodel.dart';
import '../../widgets/burger_card.dart';
import '../../widgets/shimmer_loading.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      ref.read(searchViewModelProvider.notifier).search(query);
    });
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchViewModelProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Text(
                '🔍 バーガーを探す',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: TextField(
                controller: _searchController,
                onChanged: _onQueryChanged,
                decoration: InputDecoration(
                  hintText: 'バーガー名・タグで検索...',
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    color: AppColors.textHint,
                  ),
                  suffixIcon: searchState.hasQuery
                      ? IconButton(
                          icon: const Icon(
                            Icons.clear_rounded,
                            color: AppColors.textHint,
                          ),
                          onPressed: () {
                            _searchController.clear();
                            ref
                                .read(searchViewModelProvider.notifier)
                                .clearSearch();
                          },
                        )
                      : null,
                ),
                textInputAction: TextInputAction.search,
              ),
            ),
            Expanded(
              child: _SearchBody(
                searchState: searchState,
                onBurgerTap: (id) => context.push('/burger/$id'),
                onAddToCart: (burger) {
                  ref
                      .read(cartViewModelProvider.notifier)
                      .addToCart(burger, 1);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('${burger.name} をカートに追加しました 🛒'),
                      backgroundColor: AppColors.primary,
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchBody extends StatelessWidget {
  final SearchState searchState;
  final ValueChanged<String> onBurgerTap;
  final ValueChanged<dynamic> onAddToCart;

  const _SearchBody({
    required this.searchState,
    required this.onBurgerTap,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    if (!searchState.hasQuery) {
      return const _EmptyPrompt();
    }

    if (searchState.isLoading) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.75,
          children: List.generate(4, (_) => const BurgerCardShimmer()),
        ),
      );
    }

    if (!searchState.hasResults) {
      return _NoResults(query: searchState.query);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              '${searchState.results.length}件見つかりました',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.75,
              ),
              itemCount: searchState.results.length,
              itemBuilder: (context, i) {
                final burger = searchState.results[i];
                return BurgerCard(
                  burger: burger,
                  onTap: () => onBurgerTap(burger.id),
                  onAddToCart: () => onAddToCart(burger),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyPrompt extends StatelessWidget {
  const _EmptyPrompt();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('🍔', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 16),
          Text(
            'キーワードを入力して\nお好みのバーガーを探してみよう！',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: ['人気', 'ヘルシー', '辛い', 'プレミアム', 'ヴィーガン']
                .map(
                  (tag) => GestureDetector(
                    onTap: () {
                      // This would be wired up in a real app
                    },
                    child: Chip(
                      label: Text(tag),
                      backgroundColor: AppColors.surfaceVariant,
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _NoResults extends StatelessWidget {
  final String query;

  const _NoResults({required this.query});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('😢', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 16),
          Text(
            '"$query" の検索結果がありません',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            '別のキーワードで試してみてください',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
