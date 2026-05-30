import '../models/burger.dart';
import '../models/category.dart';
import '../sources/mock_data.dart';

abstract class BurgerRepository {
  Future<List<Burger>> getBurgers();
  Future<List<Burger>> getPopularBurgers();
  Future<List<Burger>> getBurgersByCategory(String categoryId);
  Future<List<Burger>> searchBurgers(String query);
  Future<Burger?> getBurgerById(String id);
  Future<List<BurgerCategory>> getCategories();
}

class BurgerRepositoryImpl implements BurgerRepository {
  @override
  Future<List<Burger>> getBurgers() async {
    await Future.delayed(const Duration(milliseconds: 600));
    return MockData.burgers;
  }

  @override
  Future<List<Burger>> getPopularBurgers() async {
    await Future.delayed(const Duration(milliseconds: 400));
    return MockData.getPopularBurgers();
  }

  @override
  Future<List<Burger>> getBurgersByCategory(String categoryId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return MockData.getBurgersByCategory(categoryId);
  }

  @override
  Future<List<Burger>> searchBurgers(String query) async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (query.isEmpty) return [];
    return MockData.searchBurgers(query);
  }

  @override
  Future<Burger?> getBurgerById(String id) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return MockData.getBurgerById(id);
  }

  @override
  Future<List<BurgerCategory>> getCategories() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return MockData.categories;
  }
}
