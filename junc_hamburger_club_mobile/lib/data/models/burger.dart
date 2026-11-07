class Burger {
  final String id;
  final String categoryId;
  final String? categoryName;
  final String? categoryEmoji;
  final String name;
  final String description;
  final double price;
  final String? imageUrl;
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
    this.categoryName,
    this.categoryEmoji,
    required this.name,
    required this.description,
    required this.price,
    this.imageUrl,
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
    String? categoryName,
    String? categoryEmoji,
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
      categoryName: categoryName ?? this.categoryName,
      categoryEmoji: categoryEmoji ?? this.categoryEmoji,
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
      categoryId: json['categoryId'].toString(),
      categoryName: json['categoryName'] as String?,
      categoryEmoji: json['categoryEmoji'] as String?,
      name: json['name'] as String,
      description: json['description'] as String,
      price: (json['price'] as num).toDouble(),
      imageUrl: json['imageUrl'] as String?,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: json['reviewCount'] as int? ?? 0,
      isPopular: json['isPopular'] as bool? ?? false,
      isAvailable: json['isAvailable'] as bool? ?? true,
      calories: json['calories'] as int?,
      ingredients: (json['ingredients'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      tags: (json['tags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'categoryId': categoryId,
      'categoryName': categoryName,
      'categoryEmoji': categoryEmoji,
      'name': name,
      'description': description,
      'price': price,
      'imageUrl': imageUrl,
      'rating': rating,
      'reviewCount': reviewCount,
      'isPopular': isPopular,
      'isAvailable': isAvailable,
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
