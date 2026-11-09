// lib/data/models/<entity>.dart
//
// 手書き Model テンプレート。
// - freezed は使わない (禁止事項)
// - fromJson/toJson のキーは camelCase (両 API の JSON 契約と一致)
// - ID は必ず String で保持

class Review {
  final String id;
  final String userId;
  final String burgerId;
  final int rating;
  final String? comment;
  final DateTime createdAt;

  const Review({
    required this.id,
    required this.userId,
    required this.burgerId,
    required this.rating,
    this.comment,
    required this.createdAt,
  });

  Review copyWith({
    String? id,
    String? userId,
    String? burgerId,
    int? rating,
    String? comment,
    DateTime? createdAt,
  }) {
    return Review(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      burgerId: burgerId ?? this.burgerId,
      rating: rating ?? this.rating,
      comment: comment ?? this.comment,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'].toString(),
      userId: json['userId'].toString(),
      burgerId: json['burgerId'].toString(),
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'burgerId': burgerId,
      'rating': rating,
      'comment': comment,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is Review && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
