import 'package:flutter/material.dart';
import 'package:flutter_solidart/flutter_solidart.dart';
import 'package:google_fonts/google_fonts.dart';

// 启用 Rust bridge
import 'bridge_generated.dart/frb_generated.dart';

// Screens
import 'screens/connect_screen_simple.dart';
import 'screens/main_screen.dart';

// Theme
import 'theme/app_theme.dart';

// Store
import 'stores/app_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 初始化 Rust bridge
  await RustLib.init();

  // Initialize Google Fonts
  await GoogleFonts.pendingFonts([
    GoogleFonts.inter(),
  ]);

  runApp(const RiTermApp());
}

class RiTermApp extends StatelessWidget {
  const RiTermApp({super.key});

  @override
  Widget build(BuildContext context) {
    return SolidProvider(
      store: appStore,
      child: MaterialApp(
        title: 'RiTerm',
        theme: AppTheme.darkTheme,
        debugShowCheckedModeBanner: false,
        home: const AppRouter(),
      ),
    );
  }
}

class AppRouter extends StatelessWidget {
  const AppRouter({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RiTerm',
      theme: AppTheme.darkTheme,
      debugShowCheckedModeBanner: false,
      initialRoute: '/connect',
      routes: {
        '/connect': (context) => const ConnectScreenSimple(),
        '/main': (context) => const MainScreenContent(),
      },
    );
  }
}