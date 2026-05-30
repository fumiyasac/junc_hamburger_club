class AppUser {
  final String id;
  final String name;
  final String email;
  final String? profileImageUrl;
  final bool isActive;
  final DateTime createdAt;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.profileImageUrl,
    this.isActive = true,
    required this.createdAt,
  });

  AppUser copyWith({
    String? id,
    String? name,
    String? email,
    String? profileImageUrl,
    bool? isActive,
    DateTime? createdAt,
  }) {
    return AppUser(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      profileImageUrl: profileImageUrl ?? this.profileImageUrl,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'].toString(),
      name: json['name'] as String,
      email: json['email'] as String,
      profileImageUrl: json['profile_image_url'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'profile_image_url': profileImageUrl,
      'is_active': isActive,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
