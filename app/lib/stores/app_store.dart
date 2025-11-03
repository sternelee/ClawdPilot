import 'package:flutter_solidart/flutter_solidart.dart';
import 'package:uuid/uuid.dart';

// Models
class AppSession {
  final String id;
  final String name;
  final String nodeId;
  final String endpointAddr;
  final String connectionId;
  final DateTime createdAt;
  final bool isActive;

  AppSession({
    required this.id,
    required this.name,
    required this.nodeId,
    required this.endpointAddr,
    required this.connectionId,
    required this.createdAt,
    required this.isActive,
  });

  AppSession copyWith({
    String? id,
    String? name,
    String? nodeId,
    String? endpointAddr,
    String? connectionId,
    DateTime? createdAt,
    bool? isActive,
  }) {
    return AppSession(
      id: id ?? this.id,
      name: name ?? this.name,
      nodeId: nodeId ?? this.nodeId,
      endpointAddr: endpointAddr ?? this.endpointAddr,
      connectionId: connectionId ?? this.connectionId,
      createdAt: createdAt ?? this.createdAt,
      isActive: isActive ?? this.isActive,
    );
  }
}

class AppTerminal {
  final String id;
  final String? name;
  final String sessionId;
  final String shellPath;
  final String workingDir;
  final int rows;
  final int cols;
  final bool isActive;
  final DateTime createdAt;

  AppTerminal({
    required this.id,
    this.name,
    required this.sessionId,
    required this.shellPath,
    required this.workingDir,
    required this.rows,
    required this.cols,
    required this.isActive,
    required this.createdAt,
  });

  AppTerminal copyWith({
    String? id,
    String? name,
    String? sessionId,
    String? shellPath,
    String? workingDir,
    int? rows,
    int? cols,
    bool? isActive,
    DateTime? createdAt,
  }) {
    return AppTerminal(
      id: id ?? this.id,
      name: name ?? this.name,
      sessionId: sessionId ?? this.sessionId,
      shellPath: shellPath ?? this.shellPath,
      workingDir: workingDir ?? this.workingDir,
      rows: rows ?? this.rows,
      cols: cols ?? this.cols,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

enum ConnectionStatus {
  disconnected,
  connecting,
  connected,
  error,
}

enum AppTab {
  home,
  terminals,
  tcpForwarding,
  settings,
}

// App Store
class AppStore {
  final _connectionStatus = Signal(ConnectionStatus.disconnected);
  final _currentSession = Signal<AppSession?>(null);
  final _sessions = Signal<List<AppSession>>([]);
  final _terminals = Signal<List<AppTerminal>>([]);
  final _activeTerminalId = Signal<String?>(null);
  final _selectedTab = Signal(AppTab.home);
  final _statusMessage = Signal('');
  final _isLoading = Signal(false);
  final _ticketInput = Signal('');
  final _endpointInput = Signal('');
  final _error = Signal<String?>(null);

  // Getters
  ConnectionStatus get connectionStatus => _connectionStatus.value;
  AppSession? get currentSession => _currentSession.value;
  List<AppSession> get sessions => _sessions.value;
  List<AppTerminal> get terminals => _terminals.value;
  String? get activeTerminalId => _activeTerminalId.value;
  AppTab get selectedTab => _selectedTab.value;
  String get statusMessage => _statusMessage.value;
  bool get isLoading => _isLoading.value;
  String get ticketInput => _ticketInput.value;
  String get endpointInput => _endpointInput.value;
  String? get error => _error.value;

  // Setters
  void setConnectionStatus(ConnectionStatus status) {
    _connectionStatus.set(status);
  }

  void setCurrentSession(AppSession? session) {
    _currentSession.set(session);
  }

  void setSessions(List<AppSession> sessions) {
    _sessions.set(sessions);
  }

  void setTerminals(List<AppTerminal> terminals) {
    _terminals.set(terminals);
  }

  void setActiveTerminalId(String? terminalId) {
    _activeTerminalId.set(terminalId);
  }

  void setSelectedTab(AppTab tab) {
    _selectedTab.set(tab);
  }

  void setStatusMessage(String message) {
    _statusMessage.set(message);
  }

  void setLoading(bool loading) {
    _isLoading.set(loading);
  }

  void setTicketInput(String input) {
    _ticketInput.set(input);
  }

  void setEndpointInput(String input) {
    _endpointInput.set(input);
  }

  void setError(String? error) {
    _error.set(error);
  }

  // Actions
  void addSession(AppSession session) {
    final currentSessions = [..._sessions.value];
    currentSessions.add(session);
    _sessions.set(currentSessions);
  }

  void removeSession(String sessionId) {
    final currentSessions = _sessions.value.where((s) => s.id != sessionId).toList();
    _sessions.set(currentSessions);
  }

  void updateSession(String sessionId, AppSession updatedSession) {
    final currentSessions = _sessions.value.map((s) => s.id == sessionId ? updatedSession : s).toList();
    _sessions.set(currentSessions);
  }

  void addTerminal(AppTerminal terminal) {
    final currentTerminals = [..._terminals.value];
    currentTerminals.add(terminal);
    _terminals.set(currentTerminals);
  }

  void removeTerminal(String terminalId) {
    final currentTerminals = _terminals.value.where((t) => t.id != terminalId).toList();
    _terminals.set(currentTerminals);

    // Clear active terminal if it was removed
    if (_activeTerminalId.value == terminalId) {
      _activeTerminalId.set(null);
    }
  }

  void updateTerminal(String terminalId, AppTerminal updatedTerminal) {
    final currentTerminals = _terminals.value.map((t) => t.id == terminalId ? updatedTerminal : t).toList();
    _terminals.set(currentTerminals);
  }

  void clearError() {
    _error.set(null);
  }

  void reset() {
    _connectionStatus.set(ConnectionStatus.disconnected);
    _currentSession.set(null);
    _sessions.set([]);
    _terminals.set([]);
    _activeTerminalId.set(null);
    _selectedTab.set(AppTab.home);
    _statusMessage.set('');
    _isLoading.set(false);
    _ticketInput.set('');
    _endpointInput.set('');
    _error.set(null);
  }
}

// Global store instance
final appStore = AppStore();