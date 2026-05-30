import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/burger.dart';
import '../data/models/cart_item.dart';
import '../providers/providers.dart';

class CartState {
  final List<CartItem> items;
  final bool isLoading;
  final String? error;

  const CartState({
    this.items = const [],
    this.isLoading = false,
    this.error,
  });

  double get subtotal => items.fold(0.0, (sum, i) => sum + i.subtotal);
  double get tax => subtotal * 0.1;
  double get total => subtotal + tax;
  int get itemCount => items.fold(0, (sum, i) => sum + i.quantity);
  bool get isEmpty => items.isEmpty;

  CartState copyWith({
    List<CartItem>? items,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return CartState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final cartViewModelProvider =
    NotifierProvider<CartViewModel, CartState>(CartViewModel.new);

class CartViewModel extends Notifier<CartState> {
  @override
  CartState build() => const CartState();

  Future<void> addToCart(Burger burger, int quantity) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final item = await ref
          .read(cartRepositoryProvider)
          .addToCart(burger, quantity);
      final updatedItems = List<CartItem>.from(state.items);
      final idx = updatedItems.indexWhere((i) => i.burger.id == burger.id);
      if (idx >= 0) {
        updatedItems[idx] = item;
      } else {
        updatedItems.add(item);
      }
      state = state.copyWith(items: updatedItems, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> updateQuantity(String cartItemId, int quantity) async {
    if (quantity <= 0) {
      await removeFromCart(cartItemId);
      return;
    }
    try {
      final item = await ref
          .read(cartRepositoryProvider)
          .updateQuantity(cartItemId, quantity);
      final updatedItems = List<CartItem>.from(state.items);
      final idx = updatedItems.indexWhere((i) => i.id == cartItemId);
      if (idx >= 0) updatedItems[idx] = item;
      state = state.copyWith(items: updatedItems);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> removeFromCart(String cartItemId) async {
    await ref.read(cartRepositoryProvider).removeFromCart(cartItemId);
    final updatedItems =
        state.items.where((i) => i.id != cartItemId).toList();
    state = state.copyWith(items: updatedItems);
  }

  Future<void> clearCart() async {
    await ref.read(cartRepositoryProvider).clearCart();
    state = const CartState();
  }

  bool containsBurger(String burgerId) {
    return state.items.any((i) => i.burger.id == burgerId);
  }

  int quantityFor(String burgerId) {
    try {
      return state.items.firstWhere((i) => i.burger.id == burgerId).quantity;
    } catch (_) {
      return 0;
    }
  }
}
