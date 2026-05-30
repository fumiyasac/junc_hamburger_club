import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';

typedef AuthResult = ({AppUser user, String token});

abstract class UserRepository {
  Future<AuthResult> register(String name, String email, String password);
  Future<AuthResult> login(String email, String password);
  Future<AppUser?> loadStoredUser();
  Future<void> saveUser(AppUser user, String token);
  Future<void> clearUser();
}

class UserRepositoryImpl implements UserRepository {
  static const _userKey = 'user_data';
  static const _tokenKey = 'auth_token';

  final List<_StoredUser> _registeredUsers = [];

  @override
  Future<AuthResult> register(
    String name,
    String email,
    String password,
  ) async {
    await Future.delayed(const Duration(milliseconds: 800));

    if (_registeredUsers.any((u) => u.email == email)) {
      throw Exception('このメールアドレスは既に登録されています');
    }

    final user = AppUser(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: name,
      email: email,
      createdAt: DateTime.now(),
    );
    final token = 'mock_token_${user.id}';

    _registeredUsers.add(_StoredUser(
      id: user.id,
      name: name,
      email: email,
      passwordHash: password,
      token: token,
    ));

    return (user: user, token: token);
  }

  @override
  Future<AuthResult> login(String email, String password) async {
    await Future.delayed(const Duration(milliseconds: 600));

    final stored = _registeredUsers.where((u) => u.email == email).firstOrNull;
    if (stored == null || stored.passwordHash != password) {
      throw Exception('メールアドレスまたはパスワードが正しくありません');
    }

    final user = AppUser(
      id: stored.id,
      name: stored.name,
      email: stored.email,
      createdAt: DateTime.now(),
    );

    return (user: user, token: stored.token);
  }

  @override
  Future<AppUser?> loadStoredUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString(_userKey);
    if (userData == null) return null;
    try {
      return AppUser.fromJson(jsonDecode(userData) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> saveUser(AppUser user, String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
    await prefs.setString(_tokenKey, token);
  }

  @override
  Future<void> clearUser() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    await prefs.remove(_tokenKey);
  }
}

class _StoredUser {
  final String id;
  final String name;
  final String email;
  final String passwordHash;
  final String token;

  const _StoredUser({
    required this.id,
    required this.name,
    required this.email,
    required this.passwordHash,
    required this.token,
  });
}
