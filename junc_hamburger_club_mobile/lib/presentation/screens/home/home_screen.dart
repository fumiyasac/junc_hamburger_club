import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../viewmodels/auth_viewmodel.dart';
import '../../../viewmodels/cart_viewmodel.dart';
import '../../../viewmodels/home_viewmodel.dart';
import '../../../viewmodels/order_viewmodel.dart';
import '../../widgets/burger_card.dart';
import '../../widgets/category_chip.dart';
import '../../widgets/shimmer_loading.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeState = ref.watch(homeViewModelProvider);
    final user = ref.watch(authViewModelProvider.select((s) => s.user));
    final currentOrder = ref.watch(
      orderViewModelProvider.select((s) => s.currentOrder),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: homeState.when(
          loading: () => const _HomeShimmer(),
          error: (err, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('😅', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 16),
                Text('読み込みに失敗しました', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: () =>
                      ref.read(homeViewModelProvider.notifier).refresh(),
                  child: const Text('再試行'),
                ),
              ],
            ),
          ),
          data: (state) => RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.read(homeViewModelProvider.notifier).refresh(),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _Header(userName: user?.name)),
                if (currentOrder != null) ...[
                  SliverToBoxAdapter(
                    child: _ActiveOrderBanner(
                      orderId: currentOrder.id,
                      orderNumber: currentOrder.orderNumber,
                      statusLabel: currentOrder.status.label,
                      statusEmoji: currentOrder.status.emoji,
                    ),
                  ),
                ],
                SliverToBoxAdapter(
                  child: _SectionHeader(
                    title: '🔥 人気バーガー',
                    onSeeAll: () => context.go('/search'),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 230,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      scrollDirection: Axis.horizontal,
                      itemCount: state.popularBurgers.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (context, i) {
                        final burger = state.popularBurgers[i];
                        return BurgerCardHorizontal(
                          burger: burger,
                          onTap: () => context.push('/burger/${burger.id}'),
                          onAddToCart: () {
                            ref
                                .read(cartViewModelProvider.notifier)
                                .addToCart(burger, 1);
                            _showAddedSnackbar(context, burger.name);
                          },
                        );
                      },
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
                SliverToBoxAdapter(
                  child: _SectionHeader(title: '📋 カテゴリから探す'),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 48,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      scrollDirection: Axis.horizontal,
                      itemCount: state.categories.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, i) {
                        final cat = state.categories[i];
                        return CategoryChip(
                          category: cat,
                          isSelected: cat.id == state.selectedCategoryId,
                          onTap: () => ref
                              .read(homeViewModelProvider.notifier)
                              .selectCategory(cat.id),
                        );
                      },
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 16)),
                if (state.isCategoryLoading)
                  const SliverToBoxAdapter(child: _CategoryShimmer())
                else
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverGrid(
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 0.75,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, i) {
                          final burger = state.categoryBurgers[i];
                          return BurgerCard(
                            burger: burger,
                            onTap: () => context.push('/burger/${burger.id}'),
                            onAddToCart: () {
                              ref
                                  .read(cartViewModelProvider.notifier)
                                  .addToCart(burger, 1);
                              _showAddedSnackbar(context, burger.name);
                            },
                          );
                        },
                        childCount: state.categoryBurgers.length,
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showAddedSnackbar(BuildContext context, String name) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$name をカートに追加しました 🛒'),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String? userName;

  const _Header({this.userName});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'こんにちは、${userName ?? 'ゲスト'}さん 👋',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 2),
              RichText(
                text: TextSpan(
                  style: Theme.of(context).textTheme.titleLarge,
                  children: const [
                    TextSpan(text: 'JUNC '),
                    TextSpan(
                      text: '🍔',
                      style: TextStyle(fontSize: 22),
                    ),
                  ],
                ),
              ),
            ],
          ),
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.surfaceVariant,
            child: Text(
              (userName?.isNotEmpty == true)
                  ? userName![0].toUpperCase()
                  : '?',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActiveOrderBanner extends StatelessWidget {
  final String orderId;
  final String orderNumber;
  final String statusLabel;
  final String statusEmoji;

  const _ActiveOrderBanner({
    required this.orderId,
    required this.orderNumber,
    required this.statusLabel,
    required this.statusEmoji,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: GestureDetector(
        onTap: () => context.push('/order-status/$orderId'),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primary, AppColors.primaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Text(statusEmoji, style: const TextStyle(fontSize: 28)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'オーダー中 $orderNumber',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      statusLabel,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                color: Colors.white.withOpacity(0.85),
                size: 16,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onSeeAll;

  const _SectionHeader({required this.title, this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          if (onSeeAll != null)
            TextButton(
              onPressed: onSeeAll,
              child: const Text('すべて見る'),
            ),
        ],
      ),
    );
  }
}

class _HomeShimmer extends StatelessWidget {
  const _HomeShimmer();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ShimmerBox(width: 200, height: 24),
          const SizedBox(height: 8),
          const ShimmerBox(width: 140, height: 18),
          const SizedBox(height: 24),
          const ShimmerBox(width: 160, height: 20),
          const SizedBox(height: 12),
          SizedBox(
            height: 230,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 4,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, __) => const BurgerCardHorizontalShimmer(),
            ),
          ),
          const SizedBox(height: 24),
          const ShimmerBox(width: 160, height: 20),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.75,
            children: List.generate(4, (_) => const BurgerCardShimmer()),
          ),
        ],
      ),
    );
  }
}

class _CategoryShimmer extends StatelessWidget {
  const _CategoryShimmer();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.75,
        children: List.generate(4, (_) => const BurgerCardShimmer()),
      ),
    );
  }
}
