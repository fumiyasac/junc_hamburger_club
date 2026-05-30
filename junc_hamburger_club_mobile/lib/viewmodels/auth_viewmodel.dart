import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user.dart';

class AuthState {
  final bool isLoggedIn;
  final AppUser? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.isLoggedIn = false,
    this.user,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isLoggedIn,
    AppUser? user,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      isLoggedIn: isLoggedIn ?? this.isLoggedIn,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final authViewModelProvider =
    NotifierProvider<AuthViewModel, AuthState>(AuthViewModel.new);

class AuthViewModel extends Notifier<AuthState> {
  @override
  AuthState build() {
    return const AuthState();
  }

  void setLoggedIn(AppUser user) {
    state = AuthState(isLoggedIn: true, user: user);
  }

  void setLoggedOut() {
    state = const AuthState(isLoggedIn: false);
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required Future<void> Function(String name, String email, String password)
    doRegister,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await doRegister(name, email, password);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
    state = state.copyWith(isLoading: false);
  }

  Future<void> login({
    required String email,
    required String password,
    required Future<void> Function(String email, String password) doLogin,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await doLogin(email, password);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
    state = state.copyWith(isLoading: false);
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}
