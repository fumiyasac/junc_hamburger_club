class Burger {
  final String id;
  final String categoryId;
  final String name;
  final String description;
  final double price;
  final String imageUrl;
  final double rating;
  final int reviewCount;
  final bool isPopular;
  final bool isAvailable;
  final int? calories;
  final List<String> ingredients;
  final List<String> tags;

  const Burger({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.description,
    required this.price,
    required this.imageUrl,
    this.rating = 0.0,
    this.reviewCount = 0,
    this.isPopular = false,
    this.isAvailable = true,
    this.calories,
    this.ingredients = const [],
    this.tags = const [],
  });

  Burger copyWith({
    String? id,
    String? categoryId,
    String? name,
    String? description,
    double? price,
    String? imageUrl,
    double? rating,
    int? reviewCount,
    bool? isPopular,
    bool? isAvailable,
    int? calories,
    List<String>? ingredients,
    List<String>? tags,
  }) {
    return Burger(
      id: id ?? this.id,
      categoryId: categoryId ?? this.categoryId,
      name: name ?? this.name,
      description: description ?? this.description,
      price: price ?? this.price,
      imageUrl: imageUrl ?? this.imageUrl,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      isPopular: isPopular ?? this.isPopular,
      isAvailable: isAvailable ?? this.isAvailable,
      calories: calories ?? this.calories,
      ingredients: ingredients ?? this.ingredients,
      tags: tags ?? this.tags,
    );
  }

  factory Burger.fromJson(Map<String, dynamic> json) {
    return Burger(
      id: json['id'].toString(),
      categoryId: json['category_id'].toString(),
      name: json['name'] as String,
      description: json['description'] as String,
      price: (json['price'] as num).toDouble(),
      imageUrl: json['image_url'] as String,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: json['review_count'] as int? ?? 0,
      isPopular: json['is_popular'] as bool? ?? false,
      isAvailable: json['is_available'] as bool? ?? true,
      calories: json['calories'] as int?,
      ingredients: (json['ingredients'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      tags: (json['tags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'category_id': categoryId,
      'name': name,
      'description': description,
      'price': price,
      'image_url': imageUrl,
      'rating': rating,
      'review_count': reviewCount,
      'is_popular': isPopular,
      'is_available': isAvailable,
      'calories': calories,
      'ingredients': ingredients,
      'tags': tags,
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is Burger && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
