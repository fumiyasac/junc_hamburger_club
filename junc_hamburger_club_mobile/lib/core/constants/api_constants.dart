class ApiConstants {
  static const String _host = String.fromEnvironment(
    'API_HOST',
    defaultValue: '10.0.2.2',
  );
  static const String baseUrl = 'http://$_host:3100';
  static const String adminBaseUrl = 'http://$_host:8080';

  static const String register = '/api/auth/register';
  static const String login = '/api/auth/login';

  static const String burgers = '/api/burgers';
  static const String popularBurgers = '/api/burgers/popular';
  static const String searchBurgers = '/api/burgers/search';

  static const String categories = '/api/categories';

  static const String cart = '/api/cart';

  static const String orders = '/api/orders';
  static const String currentOrder = '/api/orders/current';

  static const String me = '/api/users/me';
}
