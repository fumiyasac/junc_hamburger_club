import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/services/api_client.dart';
import '../data/repositories/burger_repository.dart';
import '../data/repositories/cart_repository.dart';
import '../data/repositories/order_repository.dart';
import '../data/repositories/user_repository.dart';

// ─── Infrastructure ────────────────────────────────────────────────────────────

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

// ─── Repositories ──────────────────────────────────────────────────────────────

final burgerRepositoryProvider = Provider<BurgerRepository>(
  (ref) => BurgerRepositoryImpl(),
);

final cartRepositoryProvider = Provider<CartRepository>(
  (ref) => CartRepositoryImpl(),
);

final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => OrderRepositoryImpl(),
);

final userRepositoryProvider = Provider<UserRepository>(
  (ref) => UserRepositoryImpl(),
);
