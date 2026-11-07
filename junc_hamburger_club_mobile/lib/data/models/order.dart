enum OrderStatus {
  received,
  preparing,
  ready,
  completed,
  cancelled;

  String get label {
    switch (this) {
      case OrderStatus.received:
        return '注文受付';
      case OrderStatus.preparing:
        return '調理中';
      case OrderStatus.ready:
        return '準備完了';
      case OrderStatus.completed:
        return '受け取り済み';
      case OrderStatus.cancelled:
        return 'キャンセル';
    }
  }

  String get emoji {
    switch (this) {
      case OrderStatus.received:
        return '📋';
      case OrderStatus.preparing:
        return '👨‍🍳';
      case OrderStatus.ready:
        return '🍔';
      case OrderStatus.completed:
        return '✅';
      case OrderStatus.cancelled:
        return '❌';
    }
  }

  static OrderStatus fromString(String value) {
    switch (value) {
      case 'received':
        return OrderStatus.received;
      case 'preparing':
        return OrderStatus.preparing;
      case 'ready':
        return OrderStatus.ready;
      case 'completed':
        return OrderStatus.completed;
      case 'cancelled':
        return OrderStatus.cancelled;
      default:
        return OrderStatus.received;
    }
  }
}

/// OrderItem は API の /orders レスポンスの items[] 形状に合わせたフラット構造。
class OrderItem {
  final String id;
  final String burgerId;
  final String burgerName;
  final String? burgerImageUrl;
  final int quantity;
  final double unitPrice;
  final double subtotal;

  const OrderItem({
    required this.id,
    required this.burgerId,
    required this.burgerName,
    this.burgerImageUrl,
    required this.quantity,
    required this.unitPrice,
    required this.subtotal,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'].toString(),
      burgerId: json['burgerId'].toString(),
      burgerName: json['burgerName'] as String,
      burgerImageUrl: json['burgerImageUrl'] as String?,
      quantity: json['quantity'] as int,
      unitPrice: (json['unitPrice'] as num).toDouble(),
      subtotal: (json['subtotal'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'burgerId': burgerId,
      'burgerName': burgerName,
      'burgerImageUrl': burgerImageUrl,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'subtotal': subtotal,
    };
  }
}

class Order {
  final String id;
  final String orderNumber;
  final OrderStatus status;
  final List<OrderItem> items;
  final double totalAmount;
  final double taxAmount;
  final DateTime createdAt;
  final DateTime? estimatedReadyAt;
  final String? notes;

  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.items,
    required this.totalAmount,
    required this.taxAmount,
    required this.createdAt,
    this.estimatedReadyAt,
    this.notes,
  });

  double get subtotalAmount => totalAmount - taxAmount;

  Order copyWith({
    String? id,
    String? orderNumber,
    OrderStatus? status,
    List<OrderItem>? items,
    double? totalAmount,
    double? taxAmount,
    DateTime? createdAt,
    DateTime? estimatedReadyAt,
    String? notes,
  }) {
    return Order(
      id: id ?? this.id,
      orderNumber: orderNumber ?? this.orderNumber,
      status: status ?? this.status,
      items: items ?? this.items,
      totalAmount: totalAmount ?? this.totalAmount,
      taxAmount: taxAmount ?? this.taxAmount,
      createdAt: createdAt ?? this.createdAt,
      estimatedReadyAt: estimatedReadyAt ?? this.estimatedReadyAt,
      notes: notes ?? this.notes,
    );
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'].toString(),
      orderNumber: json['orderNumber'] as String,
      status: OrderStatus.fromString(json['status'] as String),
      items: (json['items'] as List<dynamic>)
          .map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalAmount: (json['totalAmount'] as num).toDouble(),
      taxAmount: (json['taxAmount'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      estimatedReadyAt: json['estimatedReadyAt'] != null
          ? DateTime.parse(json['estimatedReadyAt'] as String)
          : null,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'orderNumber': orderNumber,
      'status': status.name,
      'items': items.map((e) => e.toJson()).toList(),
      'totalAmount': totalAmount,
      'taxAmount': taxAmount,
      'createdAt': createdAt.toIso8601String(),
      'estimatedReadyAt': estimatedReadyAt?.toIso8601String(),
      'notes': notes,
    };
  }
}
