import 'package:flutter/material.dart';
import 'package:xterm/xterm.dart';
import 'package:qr_code_scanner/qr_code_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';
import 'src/rust/bridge_api.dart';
import 'src/rust/frb_generated.dart';
import 'src/rust/api/iroh_client.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize RustLib
  await RustLib.init();

  runApp(const RiTermApp());
}

class RiTermApp extends StatelessWidget {
  const RiTermApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RiTerm',
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        primaryColor: const Color(0xFF00D4FF),
        scaffoldBackgroundColor: const Color(0xFF1E1E2E),
        cardColor: const Color(0xFF2A2A3E),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00D4FF),
          secondary: Color(0xFF7C3AED),
          surface: Color(0xFF2A2A3E),
        ),
      ),
      home: const MainScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  bool _isInitialized = false;
  bool _isConnected = false;
  String _status = "Initializing...";
  IrohSessionInfo? _sessionInfo;
  List<FlutterSession> _sessions = [];
  List<FlutterTerminal> _terminals = [];
  Map<String, Terminal> _terminalsMap = {};
  final _ticketController = TextEditingController();
  int _selectedTabIndex = 0;

  @override
  void initState() {
    super.initState();
    _checkInitialization();
  }

  Future<void> _checkInitialization() async {
    try {
      setState(() {
        _isInitialized = true;
        _status = "RiTerm Ready";
      });
    } catch (e) {
      setState(() => _status = "Failed to initialize: $e");
    }
  }

  Future<void> _connectToTicket() async {
    final ticket = _ticketController.text.trim();

    if (ticket.isEmpty) {
      setState(() => _status = "Please enter a ticket");
      return;
    }

    if (!_validateTicket(ticket)) {
      setState(() => _status = "Invalid ticket format");
      return;
    }

    setState(() => _status = "Connecting...");

    try {
      final result = await connectToPeer(ticket: ticket);
      setState(() {
        _status = "Connected successfully!";
        _isConnected = true;
        _ticketController.clear();
      });
      _refreshSessions();
      _refreshTerminals();
    } catch (e) {
      setState(() => _status = "Failed to connect: $e");
    }
  }

  bool _validateTicket(String ticket) {
    if (ticket.isEmpty) return false;
    if (!ticket.startsWith('ticket:')) return false;
    return ticket.length > 20;
  }

  Future<void> _refreshSessions() async {
    try {
      final result = await getActiveSessions();
      setState(() => _sessions = result);
    } catch (e) {
      debugPrint("Failed to refresh sessions: $e");
    }
  }

  Future<void> _refreshTerminals() async {
    try {
      final result = await getActiveTerminals();
      setState(() => _terminals = result);
    } catch (e) {
      debugPrint("Failed to refresh terminals: $e");
    }
  }

  Future<void> _createTerminal() async {
    try {
      final result = await createTerminal(
        name: "Terminal ${_terminals.length + 1}",
        shellPath: "/bin/bash",
        workingDir: "/home",
        rows: 24,
        cols: 80,
      );
      _createXTerminal(result);
    } catch (e) {
      setState(() => _status = "Failed to create terminal: $e");
    }
  }

  void _createXTerminal(String terminalId) {
    final terminal = Terminal();
    terminal.onOutput = (data) {
      sendTerminalInput(terminalId: terminalId, input: data);
    };
    setState(() => _terminalsMap[terminalId] = terminal);
  }

  void _openTerminal(String terminalId) {
    if (_terminalsMap.containsKey(terminalId)) return;
    _createXTerminal(terminalId);
  }

  Future<void> _closeTerminal(String terminalId) async {
    try {
      await stopTerminal(terminalId: terminalId);
      setState(() {
        _terminalsMap.remove(terminalId);
        _terminals.removeWhere((t) => (t as FlutterTerminal).id == terminalId);
      });
    } catch (e) {
      debugPrint("Failed to close terminal: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isConnected ? _buildMainInterface() : _buildStartupScreen(),
    );
  }

  Widget _buildStartupScreen() {
    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo and Title
                Column(
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF00D4FF), Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF00D4FF).withValues(alpha: 0.3),
                            blurRadius: 20,
                            spreadRadius: 5,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.terminal,
                        size: 50,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'RiTerm',
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Secure Remote Terminal Access',
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey[400],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 48),

                // Status
                if (_status.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _status.contains("Failed")
                          ? Colors.red.withValues(alpha: 0.1)
                          : _status.contains("Connected")
                              ? Colors.green.withValues(alpha: 0.1)
                              : Colors.blue.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _status.contains("Failed")
                            ? Colors.red.withValues(alpha: 0.3)
                            : _status.contains("Connected")
                                ? Colors.green.withValues(alpha: 0.3)
                                : Colors.blue.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _status.contains("Failed")
                              ? Icons.error
                              : _status.contains("Connected")
                                  ? Icons.check_circle
                                  : Icons.info,
                          color: _status.contains("Failed")
                              ? Colors.red
                              : _status.contains("Connected")
                                  ? Colors.green
                                  : Colors.blue,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _status,
                            style: TextStyle(
                              color: _status.contains("Failed")
                                  ? Colors.red
                                  : _status.contains("Connected")
                                      ? Colors.green
                                      : Colors.blue,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                ],

                // Connection Section
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Connect to Remote Session',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Enter the ticket from your CLI command:',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[400],
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _ticketController,
                          decoration: InputDecoration(
                            hintText: 'ticket:abc123...',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide(color: Colors.grey[600]!),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide(color: Colors.grey[600]!),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Color(0xFF00D4FF)),
                            ),
                            prefixIcon: const Icon(Icons.link),
                            suffixIcon: Platform.isIOS || Platform.isAndroid
                                ? IconButton(
                                    icon: const Icon(Icons.qr_code_scanner),
                                    onPressed: _scanQRCode,
                                  )
                                : null,
                          ),
                          maxLines: 3,
                          onChanged: (value) {
                            if (value.isNotEmpty && !value.startsWith('ticket:')) {
                              _ticketController.text = 'ticket:$value';
                              _ticketController.selection = TextSelection.fromPosition(
                                TextPosition(offset: _ticketController.text.length),
                              );
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isInitialized ? _connectToTicket : null,
                            icon: const Icon(Icons.connect_without_contact),
                            label: const Text('Connect'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              backgroundColor: const Color(0xFF00D4FF),
                              foregroundColor: Colors.black,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // Instructions
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.info_outline, color: Colors.grey[400]),
                            const SizedBox(width: 8),
                            Text(
                              'How to get a ticket',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildInstructionStep('1', 'Run CLI: riterm host --create'),
                        _buildInstructionStep('2', 'Copy the generated ticket'),
                        _buildInstructionStep('3', 'Paste ticket above and connect'),
                        _buildInstructionStep('4', 'Start using remote terminals'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInstructionStep(String number, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$number. ',
            style: TextStyle(
              color: Color(0xFF00D4FF),
              fontWeight: FontWeight.bold,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: Colors.grey[300]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainInterface() {
    return Scaffold(
      backgroundColor: const Color(0xFF1E1E2E),
      appBar: AppBar(
        title: const Text('RiTerm'),
        backgroundColor: const Color(0xFF2A2A3E),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _createTerminal,
            tooltip: 'Create Terminal',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _refreshSessions();
              _refreshTerminals();
            },
            tooltip: 'Refresh',
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'disconnect') {
                setState(() {
                  _isConnected = false;
                  _sessions.clear();
                  _terminals.clear();
                  _terminalsMap.clear();
                  _status = "Disconnected";
                });
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'disconnect',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 18),
                    SizedBox(width: 8),
                    Text('Disconnect'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Terminal Tabs
          Container(
            height: 50,
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.grey[800]!),
              ),
            ),
            child: _terminals.isEmpty
                ? const Center(
                    child: Text(
                      'No terminals available',
                      style: TextStyle(color: Colors.grey),
                    ),
                  )
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _terminals.length,
                    itemBuilder: (context, index) {
                      final terminal = _terminals[index];
                      final isSelected = _selectedTabIndex == index;
                      return GestureDetector(
                        onTap: () {
                          setState(() => _selectedTabIndex = index);
                          _openTerminal(terminal.id);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(
                                color: isSelected
                                    ? const Color(0xFF00D4FF)
                                    : Colors.transparent,
                                width: 2,
                              ),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.terminal,
                                size: 16,
                                color: isSelected
                                    ? const Color(0xFF00D4FF)
                                    : Colors.grey[400],
                              ),
                              const SizedBox(width: 8),
                              Text(
                                terminal.name ?? 'Terminal ${index + 1}',
                                style: TextStyle(
                                  color: isSelected
                                      ? const Color(0xFF00D4FF)
                                      : Colors.grey[300],
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                ),
                              ),
                                const SizedBox(width: 8),
                              GestureDetector(
                                onTap: () => _closeTerminal(terminal.id),
                                child: Icon(
                                  Icons.close,
                                  size: 16,
                                  color: Colors.grey[500],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

          // Terminal Content
          Expanded(
            child: _terminals.isEmpty
                ? _buildEmptyState()
                : _selectedTabIndex < _terminals.length
                    ? _buildTerminalView(_terminals[_selectedTabIndex])
                    : _buildEmptyState(),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.terminal_outlined,
            size: 64,
            color: Colors.grey[600],
          ),
          const SizedBox(height: 16),
          Text(
            'No terminals available',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[400],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Create a terminal to get started',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[500],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _createTerminal,
            icon: const Icon(Icons.add),
            label: const Text('Create Terminal'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00D4FF),
              foregroundColor: Colors.black,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTerminalView(FlutterTerminal terminal) {
    final terminalId = terminal.id;
    if (!_terminalsMap.containsKey(terminalId)) {
      return Center(
        child: ElevatedButton(
          onPressed: () => _openTerminal(terminalId),
          child: const Text('Open Terminal'),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[800]!),
      ),
      child: TerminalView(_terminalsMap[terminalId]!),
    );
  }

  Future<void> _scanQRCode() async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      setState(() => _status = "QR scanning only available on mobile");
      return;
    }

    // Request camera permission
    var status = await Permission.camera.status;
    if (status.isDenied) {
      final result = await Permission.camera.request();
      if (!result.isGranted) {
        setState(() => _status = "Camera permission denied");
        return;
      }
    }

    // Navigate to QR scanner
    if (mounted) {
      final result = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => QRScannerScreen(
            onQRCodeScanned: (String code) {
              _ticketController.text = code;
              if (!_validateTicket(code)) {
                setState(() => _status = "Invalid QR code format");
              }
            },
          ),
        ),
      );

      if (result != null) {
        // User scanned a QR code, now try to connect
        _connectToTicket();
      }
    }
  }
}

class QRScannerScreen extends StatelessWidget {
  final Function(String) onQRCodeScanned;

  const QRScannerScreen({
    super.key,
    required this.onQRCodeScanned,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan QR Code'),
        backgroundColor: const Color(0xFF2A2A3E),
      ),
      body: QRView(
        key: GlobalKey(debugLabel: 'QR'),
        onQRViewCreated: (QRViewController controller) {
          controller.scannedDataStream.listen((scanData) {
            onQRCodeScanned(scanData.code!);
            Navigator.pop(context);
          });
        },
      ),
    );
  }
}