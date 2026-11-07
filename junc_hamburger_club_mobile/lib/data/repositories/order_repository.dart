import '../models/cart_item.dart';
import '../models/order.dart';

abstract class OrderRepository {
  Future<Order> createOrder(List<CartItem> items, {String? notes});
  Future<Order?> getOrderById(String id);
  Future<Order?> getCurrentOrder();
  Future<List<Order>> getOrderHistory();
}

class OrderRepositoryImpl implements OrderRepository {
  final List<Order> _orders = [];
  int _orderCounter = 1000;

  @override
  Future<Order> createOrder(List<CartItem> items, {String? notes}) async {
    await Future.delayed(const Duration(milliseconds: 800));

    _orderCounter++;
    final subtotal = items.fold(0.0, (sum, item) => sum + item.subtotal);
    final tax = subtotal * 0.1;
    final total = subtotal + tax;

    final orderItems = items
        .map(
          (i) => OrderItem(
            id: '${i.id}_oi',
            burgerId: i.burgerId,
            burgerName: i.burgerName,
            burgerImageUrl: i.burgerImageUrl,
            quantity: i.quantity,
            unitPrice: i.burgerPrice,
            subtotal: i.subtotal,
          ),
        )
        .toList();

    final order = Order(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      orderNumber: '#$_orderCounter',
      status: OrderStatus.received,
      items: orderItems,
      totalAmount: total,
      taxAmount: tax,
      createdAt: DateTime.now(),
      estimatedReadyAt: DateTime.now().add(const Duration(minutes: 15)),
      notes: notes,
    );

    _orders.add(order);
    return order;
  }

  @override
  Future<Order?> getOrderById(String id) async {
    try {
      final order = _orders.firstWhere((o) => o.id == id);
      return _withSimulatedStatus(order);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<Order?> getCurrentOrder() async {
    try {
      final order = _orders.lastWhere(
        (o) =>
            o.status != OrderStatus.completed &&
            o.status != OrderStatus.cancelled,
      );
      return _withSimulatedStatus(order);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<List<Order>> getOrderHistory() async {
    return _orders.map(_withSimulatedStatus).toList().reversed.toList();
  }

  Order _withSimulatedStatus(Order order) {
    final elapsed = DateTime.now().difference(order.createdAt);
    OrderStatus status;

    if (elapsed.inSeconds < 15) {
      status = OrderStatus.received;
    } else if (elapsed.inSeconds < 40) {
      status = OrderStatus.preparing;
    } else if (elapsed.inSeconds < 60) {
      status = OrderStatus.ready;
    } else {
      status = OrderStatus.completed;
    }

    return order.copyWith(status: status);
  }
}
