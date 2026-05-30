import 'package:badges/badges.dart' as badges;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../viewmodels/cart_viewmodel.dart';

class MainShell extends ConsumerWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  int _locationToIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/search')) return 1;
    if (location.startsWith('/cart')) return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartItemCount = ref.watch(
      cartViewModelProvider.select((s) => s.itemCount),
    );
    final selectedIndex = _locationToIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: _BottomNav(
        selectedIndex: selectedIndex,
        cartItemCount: cartItemCount,
        onTap: (index) {
          switch (index) {
            case 0:
              context.go('/home');
            case 1:
              context.go('/search');
            case 2:
              context.go('/cart');
          }
        },
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int selectedIndex;
  final int cartItemCount;
  final ValueChanged<int> onTap;

  const _BottomNav({
    required this.selectedIndex,
    required this.cartItemCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _NavItem(
                icon: Icons.home_rounded,
                label: 'ホーム',
                isSelected: selectedIndex == 0,
                onTap: () => onTap(0),
              ),
              _NavItem(
                icon: Icons.search_rounded,
                label: '検索',
                isSelected: selectedIndex == 1,
                onTap: () => onTap(1),
              ),
              _CartNavItem(
                isSelected: selectedIndex == 2,
                itemCount: cartItemCount,
                onTap: () => onTap(2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.primary.withOpacity(0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(
              icon,
              color: isSelected ? AppColors.primary : AppColors.textHint,
              size: 26,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: isSelected ? AppColors.primary : AppColors.textHint,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _CartNavItem extends StatelessWidget {
  final bool isSelected;
  final int itemCount;
  final VoidCallback onTap;

  const _CartNavItem({
    required this.isSelected,
    required this.itemCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.primary.withOpacity(0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: badges.Badge(
              showBadge: itemCount > 0,
              badgeContent: Text(
                itemCount > 9 ? '9+' : '$itemCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                ),
              ),
              badgeStyle: const badges.BadgeStyle(
                badgeColor: AppColors.primary,
                padding: EdgeInsets.all(4),
              ),
              child: Icon(
                Icons.shopping_cart_rounded,
                color: isSelected ? AppColors.primary : AppColors.textHint,
                size: 26,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'カート',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: isSelected ? AppColors.primary : AppColors.textHint,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
