import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/burger.dart';
import '../../../providers/providers.dart';
import '../../../viewmodels/cart_viewmodel.dart';

class BurgerDetailScreen extends ConsumerStatefulWidget {
  final String burgerId;

  const BurgerDetailScreen({super.key, required this.burgerId});

  @override
  ConsumerState<BurgerDetailScreen> createState() => _BurgerDetailScreenState();
}

class _BurgerDetailScreenState extends ConsumerState<BurgerDetailScreen> {
  int _quantity = 1;
  Burger? _burger;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadBurger();
  }

  Future<void> _loadBurger() async {
    final burger = await ref
        .read(burgerRepositoryProvider)
        .getBurgerById(widget.burgerId);
    if (mounted) {
      setState(() {
        _burger = burger;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const _DetailShimmer();
    if (_burger == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('バーガーが見つかりません 😢')),
      );
    }

    final burger = _burger!;
    final inCart = ref.watch(
      cartViewModelProvider.select(
        (s) => s.items.any((i) => i.burgerId == burger.id),
      ),
    );

    return Scaffold(
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              _HeroAppBar(burger: burger),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _TagChips(tags: burger.tags),
                      const SizedBox(height: 8),
                      Text(
                        burger.name,
                        style: Theme.of(context).textTheme.displayMedium?.copyWith(
                          fontSize: 26,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _RatingRow(burger: burger),
                      const SizedBox(height: 12),
                      Text(
                        burger.description,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          height: 1.6,
                        ),
                      ),
                      if (burger.calories != null) ...[
                        const SizedBox(height: 16),
                        _InfoRow(
                          icon: Icons.local_fire_department_rounded,
                          label: 'カロリー',
                          value: '${burger.calories} kcal',
                          color: AppColors.warning,
                        ),
                      ],
                      if (burger.ingredients.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Text(
                          '材料',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: burger.ingredients
                              .map(
                                (ing) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceVariant,
                                    borderRadius: BorderRadius.circular(100),
                                  ),
                                  child: Text(
                                    ing,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall?.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                      const SizedBox(height: 120),
                    ],
                  ),
                ),
              ),
            ],
          ),
          _BottomBar(
            burger: burger,
            quantity: _quantity,
            inCart: inCart,
            onDecrement: () => setState(
              () => _quantity = (_quantity - 1).clamp(1, 99),
            ),
            onIncrement: () => setState(() => _quantity++),
            onAddToCart: () {
              ref
                  .read(cartViewModelProvider.notifier)
                  .addToCart(burger, _quantity);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('${burger.name} × $_quantity をカートに追加しました 🛒'),
                  backgroundColor: AppColors.primary,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              );
              context.pop();
            },
          ),
        ],
      ),
    );
  }
}

class _HeroAppBar extends StatelessWidget {
  final Burger burger;

  const _HeroAppBar({required this.burger});

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 280,
      pinned: true,
      backgroundColor: AppColors.surface,
      leading: Padding(
        padding: const EdgeInsets.all(8),
        child: CircleAvatar(
          backgroundColor: Colors.white,
          child: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, size: 20),
            color: AppColors.textPrimary,
            onPressed: () => context.pop(),
          ),
        ),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: CachedNetworkImage(
          imageUrl: burger.imageUrl ?? '',
          fit: BoxFit.cover,
          placeholder: (context, url) => Shimmer.fromColors(
            baseColor: Colors.grey[300]!,
            highlightColor: Colors.grey[100]!,
            child: Container(color: Colors.white),
          ),
          errorWidget: (context, url, error) => Container(
            color: AppColors.surfaceVariant,
            child: const Center(
              child: Text('🍔', style: TextStyle(fontSize: 80)),
            ),
          ),
        ),
      ),
    );
  }
}

class _TagChips extends StatelessWidget {
  final List<String> tags;

  const _TagChips({required this.tags});

  @override
  Widget build(BuildContext context) {
    if (tags.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      children: tags
          .map(
            (tag) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(100),
              ),
              child: Text(
                tag,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.primaryDark,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _RatingRow extends StatelessWidget {
  final Burger burger;

  const _RatingRow({required this.burger});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        RatingBarIndicator(
          rating: burger.rating,
          itemBuilder: (context, _) =>
              const Icon(Icons.star_rounded, color: AppColors.secondary),
          itemCount: 5,
          itemSize: 20,
        ),
        const SizedBox(width: 8),
        Text(
          burger.rating.toStringAsFixed(1),
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(width: 4),
        Text(
          '(${burger.reviewCount}件のレビュー)',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 6),
        Text(
          '$label: ',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _BottomBar extends StatelessWidget {
  final Burger burger;
  final int quantity;
  final bool inCart;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;
  final VoidCallback onAddToCart;

  const _BottomBar({
    required this.burger,
    required this.quantity,
    required this.inCart,
    required this.onDecrement,
    required this.onIncrement,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          MediaQuery.of(context).padding.bottom + 16,
        ),
        decoration: BoxDecoration(
          color: AppColors.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.divider, width: 1.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  _QtyButton(icon: Icons.remove_rounded, onTap: onDecrement),
                  SizedBox(
                    width: 36,
                    child: Text(
                      '$quantity',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  _QtyButton(icon: Icons.add_rounded, onTap: onIncrement),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: onAddToCart,
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      inCart ? AppColors.accent : AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(
                  inCart
                      ? '追加する ¥${(burger.price * quantity).toInt()}'
                      : 'カートに入れる ¥${(burger.price * quantity).toInt()}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QtyButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _QtyButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Icon(icon, size: 20, color: AppColors.textPrimary),
      ),
    );
  }
}

class _DetailShimmer extends StatelessWidget {
  const _DetailShimmer();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Shimmer.fromColors(
        baseColor: Colors.grey[300]!,
        highlightColor: Colors.grey[100]!,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(height: 280, color: Colors.white),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(height: 28, width: double.infinity, color: Colors.white),
                  const SizedBox(height: 8),
                  Container(height: 20, width: 200, color: Colors.white),
                  const SizedBox(height: 16),
                  Container(height: 16, width: double.infinity, color: Colors.white),
                  const SizedBox(height: 6),
                  Container(height: 16, width: 260, color: Colors.white),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
