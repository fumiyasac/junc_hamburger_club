class BurgerCategory {
  final String id;
  final String name;
  final String emoji;
  final String description;
  final int displayOrder;
  final bool isActive;

  const BurgerCategory({
    required this.id,
    required this.name,
    required this.emoji,
    this.description = '',
    this.displayOrder = 0,
    this.isActive = true,
  });

  BurgerCategory copyWith({
    String? id,
    String? name,
    String? emoji,
    String? description,
    int? displayOrder,
    bool? isActive,
  }) {
    return BurgerCategory(
      id: id ?? this.id,
      name: name ?? this.name,
      emoji: emoji ?? this.emoji,
      description: description ?? this.description,
      displayOrder: displayOrder ?? this.displayOrder,
      isActive: isActive ?? this.isActive,
    );
  }

  factory BurgerCategory.fromJson(Map<String, dynamic> json) {
    return BurgerCategory(
      id: json['id'].toString(),
      name: json['name'] as String,
      emoji: json['emoji'] as String? ?? '🍔',
      description: json['description'] as String? ?? '',
      displayOrder: json['display_order'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'emoji': emoji,
      'description': description,
      'display_order': displayOrder,
      'is_active': isActive,
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is BurgerCategory && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
