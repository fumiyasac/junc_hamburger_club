import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/burger.dart';
import '../providers/providers.dart';

class SearchState {
  final String query;
  final List<Burger> results;
  final bool isLoading;
  final String? error;

  const SearchState({
    this.query = '',
    this.results = const [],
    this.isLoading = false,
    this.error,
  });

  bool get hasQuery => query.isNotEmpty;
  bool get hasResults => results.isNotEmpty;

  SearchState copyWith({
    String? query,
    List<Burger>? results,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return SearchState(
      query: query ?? this.query,
      results: results ?? this.results,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final searchViewModelProvider =
    NotifierProvider<SearchViewModel, SearchState>(SearchViewModel.new);

class SearchViewModel extends Notifier<SearchState> {
  @override
  SearchState build() => const SearchState();

  Future<void> search(String query) async {
    state = state.copyWith(query: query, isLoading: true, clearError: true);

    if (query.isEmpty) {
      state = state.copyWith(results: [], isLoading: false);
      return;
    }

    try {
      final results = await ref.read(burgerRepositoryProvider).searchBurgers(
        query,
      );
      state = state.copyWith(results: results, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        results: [],
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  void clearSearch() {
    state = const SearchState();
  }
}
