import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../presentation/screens/onboarding/onboarding_screen.dart';
import '../../presentation/screens/onboarding/register_screen.dart';
import '../../presentation/screens/main_shell/main_shell.dart';
import '../../presentation/screens/home/home_screen.dart';
import '../../presentation/screens/home/burger_detail_screen.dart';
import '../../presentation/screens/search/search_screen.dart';
import '../../presentation/screens/cart/cart_screen.dart';
import '../../presentation/screens/cart/order_complete_screen.dart';
import '../../presentation/screens/orders/order_status_screen.dart';

class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(this._ref) {
    _ref.listen<AuthState>(authViewModelProvider, (_, next) {
      _isLoggedIn = next.isLoggedIn;
      notifyListeners();
    });
    _isLoggedIn = _ref.read(authViewModelProvider).isLoggedIn;
  }

  final Ref _ref;
  bool _isLoggedIn = false;

  String? redirect(BuildContext context, GoRouterState state) {
    final onAuthScreen = state.matchedLocation == '/onboarding' ||
        state.matchedLocation == '/register';

    if (!_isLoggedIn && !onAuthScreen) return '/onboarding';
    if (_isLoggedIn && onAuthScreen) return '/home';
    return null;
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _RouterNotifier(ref);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    initialLocation: '/home',
    refreshListenable: notifier,
    redirect: notifier.redirect,
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: HomeScreen()),
          ),
          GoRoute(
            path: '/search',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: SearchScreen()),
          ),
          GoRoute(
            path: '/cart',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: CartScreen()),
          ),
        ],
      ),
      GoRoute(
        path: '/burger/:id',
        builder: (context, state) =>
            BurgerDetailScreen(burgerId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/order-complete/:orderId',
        builder: (context, state) =>
            OrderCompleteScreen(orderId: state.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/order-status/:orderId',
        builder: (context, state) =>
            OrderStatusScreen(orderId: state.pathParameters['orderId']!),
      ),
    ],
  );
});
