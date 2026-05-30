import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../core/theme/app_theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _currentPage = 0;

  static const _pages = [
    _OnboardingPage(
      emoji: '🍔',
      title: 'JUNC Hamburger\nClubへようこそ！',
      description: '本格的なハンバーガーを\nあなたの手元に。\nスマホで簡単注文！',
      bgColor: Color(0xFFFFF0F0),
      dotColor: AppColors.primary,
    ),
    _OnboardingPage(
      emoji: '✨',
      title: 'こだわりメニューを\n自由に選んで',
      description: 'クラシックからグルメまで\n20種類以上のハンバーガー。\nあなた好みの一品を見つけよう！',
      bgColor: Color(0xFFFFFBE6),
      dotColor: AppColors.secondary,
    ),
    _OnboardingPage(
      emoji: '🎉',
      title: 'できたてを\nすぐ受け取れる',
      description: 'オーダーして待つだけ！\nリアルタイムで調理状況を確認。\n準備完了の通知でスムーズ受け取り。',
      bgColor: Color(0xFFEFF9F1),
      dotColor: AppColors.accent,
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    } else {
      context.go('/register');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: TextButton(
                onPressed: () => context.go('/register'),
                child: Text(
                  'スキップ',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (i) => setState(() => _currentPage = i),
                itemCount: _pages.length,
                itemBuilder: (context, i) => _OnboardingPageView(page: _pages[i]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: Column(
                children: [
                  SmoothPageIndicator(
                    controller: _pageController,
                    count: _pages.length,
                    effect: ExpandingDotsEffect(
                      activeDotColor: _pages[_currentPage].dotColor,
                      dotColor: AppColors.divider,
                      dotHeight: 8,
                      dotWidth: 8,
                      expansionFactor: 3,
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _nextPage,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Text(
                        _currentPage == _pages.length - 1
                            ? 'はじめる 🍔'
                            : '次へ',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'すでにアカウントをお持ちの方は ',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      GestureDetector(
                        onTap: () => context.go('/register'),
                        child: Text(
                          'こちら',
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPage {
  final String emoji;
  final String title;
  final String description;
  final Color bgColor;
  final Color dotColor;

  const _OnboardingPage({
    required this.emoji,
    required this.title,
    required this.description,
    required this.bgColor,
    required this.dotColor,
  });
}

class _OnboardingPageView extends StatelessWidget {
  final _OnboardingPage page;

  const _OnboardingPageView({required this.page});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              color: page.bgColor,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                page.emoji,
                style: const TextStyle(fontSize: 96),
              ),
            ),
          ),
          const SizedBox(height: 48),
          Text(
            page.title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
              fontWeight: FontWeight.w800,
              height: 1.3,
              fontSize: 28,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            page.description,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
