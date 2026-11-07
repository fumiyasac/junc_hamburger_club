import '../models/cart_item.dart';
import '../models/burger.dart';

abstract class CartRepository {
  Future<List<CartItem>> getCartItems();
  Future<CartItem> addToCart(Burger burger, int quantity);
  Future<CartItem> updateQuantity(String cartItemId, int quantity);
  Future<void> removeFromCart(String cartItemId);
  Future<void> clearCart();
}

class CartRepositoryImpl implements CartRepository {
  final List<CartItem> _items = [];

  @override
  Future<List<CartItem>> getCartItems() async {
    return List.unmodifiable(_items);
  }

  @override
  Future<CartItem> addToCart(Burger burger, int quantity) async {
    final existing = _items.where((i) => i.burgerId == burger.id).firstOrNull;
    if (existing != null) {
      final updated = existing.copyWith(quantity: existing.quantity + quantity);
      final index = _items.indexWhere((i) => i.id == existing.id);
      _items[index] = updated;
      return updated;
    }
    final item = CartItem(
      id: 'cart_${burger.id}_${DateTime.now().millisecondsSinceEpoch}',
      burgerId: burger.id,
      burgerName: burger.name,
      burgerPrice: burger.price,
      burgerImageUrl: burger.imageUrl,
      quantity: quantity,
    );
    _items.add(item);
    return item;
  }

  @override
  Future<CartItem> updateQuantity(String cartItemId, int quantity) async {
    final index = _items.indexWhere((i) => i.id == cartItemId);
    if (index == -1) throw Exception('Cart item not found');
    final updated = _items[index].copyWith(quantity: quantity);
    _items[index] = updated;
    return updated;
  }

  @override
  Future<void> removeFromCart(String cartItemId) async {
    _items.removeWhere((i) => i.id == cartItemId);
  }

  @override
  Future<void> clearCart() async {
    _items.clear();
  }
}
