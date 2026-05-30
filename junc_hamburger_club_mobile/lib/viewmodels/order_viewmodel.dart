import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/cart_item.dart';
import '../data/models/order.dart';
import '../providers/providers.dart';

class OrderState {
  final Order? currentOrder;
  final List<Order> orderHistory;
  final bool isLoading;
  final String? error;

  const OrderState({
    this.currentOrder,
    this.orderHistory = const [],
    this.isLoading = false,
    this.error,
  });

  OrderState copyWith({
    Order? currentOrder,
    List<Order>? orderHistory,
    bool? isLoading,
    String? error,
    bool clearError = false,
    bool clearCurrentOrder = false,
  }) {
    return OrderState(
      currentOrder: clearCurrentOrder ? null : (currentOrder ?? this.currentOrder),
      orderHistory: orderHistory ?? this.orderHistory,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final orderViewModelProvider =
    NotifierProvider<OrderViewModel, OrderState>(OrderViewModel.new);

class OrderViewModel extends Notifier<OrderState> {
  @override
  OrderState build() => const OrderState();

  Future<Order?> createOrder(List<CartItem> items, {String? notes}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final order = await ref
          .read(orderRepositoryProvider)
          .createOrder(items, notes: notes);
      state = state.copyWith(
        currentOrder: order,
        orderHistory: [order, ...state.orderHistory],
        isLoading: false,
      );
      return order;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return null;
    }
  }

  Future<Order?> refreshOrderStatus(String orderId) async {
    try {
      final order = await ref.read(orderRepositoryProvider).getOrderById(orderId);
      if (order != null) {
        state = state.copyWith(currentOrder: order);
      }
      return order;
    } catch (_) {
      return null;
    }
  }

  Future<void> loadCurrentOrder() async {
    try {
      final order = await ref.read(orderRepositoryProvider).getCurrentOrder();
      state = state.copyWith(currentOrder: order);
    } catch (_) {}
  }

  Future<void> loadOrderHistory() async {
    state = state.copyWith(isLoading: true);
    try {
      final orders = await ref.read(orderRepositoryProvider).getOrderHistory();
      state = state.copyWith(orderHistory: orders, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}
