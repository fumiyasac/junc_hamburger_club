/// CartItem は API の /cart レスポンス形状に合わせたフラット構造。
/// Burger の全情報は持たず、カート表示に必要なフィールドのみを保持する。
class CartItem {
  final String id;
  final String burgerId;
  final String burgerName;
  final double burgerPrice;
  final String? burgerImageUrl;
  final int quantity;

  const CartItem({
    required this.id,
    required this.burgerId,
    required this.burgerName,
    required this.burgerPrice,
    this.burgerImageUrl,
    required this.quantity,
  });

  double get subtotal => burgerPrice * quantity;

  CartItem copyWith({
    String? id,
    String? burgerId,
    String? burgerName,
    double? burgerPrice,
    String? burgerImageUrl,
    int? quantity,
  }) {
    return CartItem(
      id: id ?? this.id,
      burgerId: burgerId ?? this.burgerId,
      burgerName: burgerName ?? this.burgerName,
      burgerPrice: burgerPrice ?? this.burgerPrice,
      burgerImageUrl: burgerImageUrl ?? this.burgerImageUrl,
      quantity: quantity ?? this.quantity,
    );
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'].toString(),
      burgerId: json['burgerId'].toString(),
      burgerName: json['burgerName'] as String,
      burgerPrice: (json['burgerPrice'] as num).toDouble(),
      burgerImageUrl: json['burgerImageUrl'] as String?,
      quantity: json['quantity'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'burgerId': burgerId,
      'burgerName': burgerName,
      'burgerPrice': burgerPrice,
      'burgerImageUrl': burgerImageUrl,
      'quantity': quantity,
      'subtotal': subtotal,
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is CartItem && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
