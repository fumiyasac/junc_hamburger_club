import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/burger.dart';
import '../data/models/category.dart';
import '../providers/providers.dart';

class HomeState {
  final List<Burger> popularBurgers;
  final List<BurgerCategory> categories;
  final String? selectedCategoryId;
  final List<Burger> categoryBurgers;
  final bool isCategoryLoading;
  final String? error;

  const HomeState({
    this.popularBurgers = const [],
    this.categories = const [],
    this.selectedCategoryId,
    this.categoryBurgers = const [],
    this.isCategoryLoading = false,
    this.error,
  });

  HomeState copyWith({
    List<Burger>? popularBurgers,
    List<BurgerCategory>? categories,
    String? selectedCategoryId,
    List<Burger>? categoryBurgers,
    bool? isCategoryLoading,
    String? error,
    bool clearError = false,
  }) {
    return HomeState(
      popularBurgers: popularBurgers ?? this.popularBurgers,
      categories: categories ?? this.categories,
      selectedCategoryId: selectedCategoryId ?? this.selectedCategoryId,
      categoryBurgers: categoryBurgers ?? this.categoryBurgers,
      isCategoryLoading: isCategoryLoading ?? this.isCategoryLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final homeViewModelProvider =
    AsyncNotifierProvider<HomeViewModel, HomeState>(HomeViewModel.new);

class HomeViewModel extends AsyncNotifier<HomeState> {
  @override
  Future<HomeState> build() async {
    final repo = ref.read(burgerRepositoryProvider);
    final results = await Future.wait([
      repo.getPopularBurgers(),
      repo.getCategories(),
    ]);

    final popular = results[0] as List<Burger>;
    final categories = results[1] as List<BurgerCategory>;

    List<Burger> categoryBurgers = [];
    String? selectedCategoryId;

    if (categories.isNotEmpty) {
      selectedCategoryId = categories.first.id;
      categoryBurgers = await repo.getBurgersByCategory(selectedCategoryId);
    }

    return HomeState(
      popularBurgers: popular,
      categories: categories,
      selectedCategoryId: selectedCategoryId,
      categoryBurgers: categoryBurgers,
    );
  }

  Future<void> selectCategory(String categoryId) async {
    final current = state.value ?? const HomeState();
    state = AsyncValue.data(
      current.copyWith(
        selectedCategoryId: categoryId,
        isCategoryLoading: true,
        clearError: true,
      ),
    );

    try {
      final burgers = await ref
          .read(burgerRepositoryProvider)
          .getBurgersByCategory(categoryId);
      state = AsyncValue.data(
        current.copyWith(
          selectedCategoryId: categoryId,
          categoryBurgers: burgers,
          isCategoryLoading: false,
        ),
      );
    } catch (e) {
      state = AsyncValue.data(
        current.copyWith(
          selectedCategoryId: categoryId,
          isCategoryLoading: false,
          error: e.toString(),
        ),
      );
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }
}
