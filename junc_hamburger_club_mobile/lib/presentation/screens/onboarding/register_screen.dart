import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../providers/providers.dart';
import '../../../viewmodels/auth_viewmodel.dart';

enum _AuthMode { register, login }

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  _AuthMode _mode = _AuthMode.register;
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _toggleMode() {
    setState(() {
      _mode = _mode == _AuthMode.register ? _AuthMode.login : _AuthMode.register;
      _errorMessage = null;
      _formKey.currentState?.reset();
    });
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final userRepo = ref.read(userRepositoryProvider);
      final authVM = ref.read(authViewModelProvider.notifier);

      if (_mode == _AuthMode.register) {
        final result = await userRepo.register(
          _nameController.text.trim(),
          _emailController.text.trim(),
          _passwordController.text,
        );
        await userRepo.saveUser(result.user, result.token);
        authVM.setLoggedIn(result.user);
      } else {
        final result = await userRepo.login(
          _emailController.text.trim(),
          _passwordController.text,
        );
        await userRepo.saveUser(result.user, result.token);
        authVM.setLoggedIn(result.user);
      }

      if (mounted) context.go('/home');
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isRegister = _mode == _AuthMode.register;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 16),
                Center(
                  child: Column(
                    children: [
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Text('🍔', style: TextStyle(fontSize: 44)),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'JUNC Hamburger Club',
                        style:
                            Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  isRegister ? '新規会員登録' : 'ログイン',
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isRegister ? 'アカウントを作成してご注文を始めましょう' : 'おかえりなさい！',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 28),
                if (isRegister) ...[
                  _InputField(
                    controller: _nameController,
                    label: 'お名前',
                    hint: '田中 太郎',
                    icon: Icons.person_rounded,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'お名前を入力してください';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],
                _InputField(
                  controller: _emailController,
                  label: 'メールアドレス',
                  hint: 'example@email.com',
                  icon: Icons.email_rounded,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'メールアドレスを入力してください';
                    if (!v.contains('@')) return '正しいメールアドレスを入力してください';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                _InputField(
                  controller: _passwordController,
                  label: 'パスワード',
                  hint: '8文字以上',
                  icon: Icons.lock_rounded,
                  isPassword: true,
                  obscureText: _obscurePassword,
                  onToggleObscure: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'パスワードを入力してください';
                    if (isRegister && v.length < 8) return '8文字以上で入力してください';
                    return null;
                  },
                ),
                if (isRegister) ...[
                  const SizedBox(height: 16),
                  _InputField(
                    controller: _confirmPasswordController,
                    label: 'パスワード（確認）',
                    hint: 'もう一度入力してください',
                    icon: Icons.lock_outline_rounded,
                    isPassword: true,
                    obscureText: _obscurePassword,
                    onToggleObscure: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                    validator: (v) {
                      if (v != _passwordController.text) return 'パスワードが一致しません';
                      return null;
                    },
                  ),
                ],
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.error.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.error_outline_rounded,
                          color: AppColors.error,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.error,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(isRegister ? '登録する 🎉' : 'ログイン'),
                  ),
                ),
                const SizedBox(height: 16),
                Center(
                  child: TextButton(
                    onPressed: _toggleMode,
                    child: RichText(
                      text: TextSpan(
                        style: Theme.of(context).textTheme.bodyMedium,
                        children: [
                          TextSpan(
                            text: isRegister
                                ? 'すでにアカウントをお持ちの方は '
                                : 'アカウントをお持ちでない方は ',
                          ),
                          TextSpan(
                            text: isRegister ? 'ログイン' : '新規登録',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (isRegister) ...[
                  const SizedBox(height: 24),
                  Center(
                    child: Text(
                      '登録することで利用規約・プライバシーポリシーに同意したことになります',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textHint,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final bool isPassword;
  final bool obscureText;
  final VoidCallback? onToggleObscure;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;

  const _InputField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.isPassword = false,
    this.obscureText = false,
    this.onToggleObscure,
    this.keyboardType,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          obscureText: isPassword && obscureText,
          keyboardType: keyboardType,
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, color: AppColors.textHint, size: 20),
            suffixIcon: isPassword
                ? IconButton(
                    icon: Icon(
                      obscureText
                          ? Icons.visibility_off_rounded
                          : Icons.visibility_rounded,
                      color: AppColors.textHint,
                      size: 20,
                    ),
                    onPressed: onToggleObscure,
                  )
                : null,
          ),
        ),
      ],
    );
  }
}
