import 'burger.dart';

class CartItem {
  final String id;
  final Burger burger;
  int quantity;

  CartItem({
    required this.id,
    required this.burger,
    required this.quantity,
  });

  double get subtotal => burger.price * quantity;

  CartItem copyWith({
    String? id,
    Burger? burger,
    int? quantity,
  }) {
    return CartItem(
      id: id ?? this.id,
      burger: burger ?? this.burger,
      quantity: quantity ?? this.quantity,
    );
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'].toString(),
      burger: Burger.fromJson(json['burger'] as Map<String, dynamic>),
      quantity: json['quantity'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'burger': burger.toJson(),
      'quantity': quantity,
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is CartItem && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
