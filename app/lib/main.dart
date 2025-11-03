import 'package:flutter/material.dart';
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

  // 初始化 Rust bridge (禁用内容哈希检查)
  await RustLib.init(forceSameCodegenVersion: false);

  // Initialize Google Fonts (with error handling)
  try {
    await GoogleFonts.pendingFonts([
      GoogleFonts.inter(),
    ]);
  } catch (e) {
    // If fonts fail to load, continue with system fonts
    debugPrint('Failed to load Google Fonts: $e');
  }

  // Handle app lifecycle
  AppLifecycleBinding.instance.init();

  runApp(const RiTermApp());
}

class AppLifecycleBinding extends WidgetsBindingObserver {
  static final AppLifecycleBinding instance = AppLifecycleBinding._internal();
  AppLifecycleBinding._internal();

  void init() {
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.detached) {
      // App is being destroyed, clean up resources
      _cleanup();
    }
  }

  void _cleanup() {
    try {
      // Reset the app store
      appStore.reset();
    } catch (e) {
      // Ignore errors during cleanup
      debugPrint('Error during cleanup: $e');
    }
  }
}

class RiTermApp extends StatelessWidget {
  const RiTermApp({super.key});

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