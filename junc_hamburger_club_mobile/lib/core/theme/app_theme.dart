import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const primary = Color(0xFFFF6B6B);
  static const primaryLight = Color(0xFFFF9A9A);
  static const primaryDark = Color(0xFFE54F4F);
  static const secondary = Color(0xFFFFD93D);
  static const secondaryLight = Color(0xFFFFE88A);
  static const accent = Color(0xFF6BCB77);
  static const background = Color(0xFFFFF8F8);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceVariant = Color(0xFFFFF0F0);
  static const textPrimary = Color(0xFF2D2D2D);
  static const textSecondary = Color(0xFF888888);
  static const textHint = Color(0xFFBBBBBB);
  static const divider = Color(0xFFEEEEEE);
  static const error = Color(0xFFE53935);
  static const success = Color(0xFF43A047);
  static const warning = Color(0xFFFFA726);
  static const cardShadow = Color(0x1AFF6B6B);
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.surface,
        error: AppColors.error,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: AppColors.background,
      textTheme: GoogleFonts.nunitoTextTheme().copyWith(
        displayLarge: GoogleFonts.nunito(
          fontSize: 32,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
        ),
        displayMedium: GoogleFonts.nunito(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
        titleLarge: GoogleFonts.nunito(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
        titleMedium: GoogleFonts.nunito(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        titleSmall: GoogleFonts.nunito(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        bodyLarge: GoogleFonts.nunito(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: AppColors.textPrimary,
        ),
        bodyMedium: GoogleFonts.nunito(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
        ),
        bodySmall: GoogleFonts.nunito(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
        ),
        labelLarge: GoogleFonts.nunito(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: AppColors.surface,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.nunito(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.surface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: GoogleFonts.nunito(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: const BorderSide(color: AppColors.primary, width: 2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: GoogleFonts.nunito(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceVariant,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        hintStyle: GoogleFonts.nunito(
          color: AppColors.textHint,
          fontSize: 14,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceVariant,
        selectedColor: AppColors.primary,
        labelStyle: GoogleFonts.nunito(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(50),
        ),
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textHint,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        showUnselectedLabels: true,
      ),
    );
  }
}
