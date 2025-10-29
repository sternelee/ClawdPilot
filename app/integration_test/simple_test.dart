import 'package:flutter_test/flutter_test.dart';
import 'package:riterm/main.dart';
import 'package:riterm/src/rust/frb_generated.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async => await RustLib.init());
  testWidgets('Can launch app', (WidgetTester tester) async {
    await tester.pumpWidget(const RiTermApp());
    await tester.pumpAndSettle();
    expect(find.byType(RiTermApp), findsOneWidget);
  });
}
