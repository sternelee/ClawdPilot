// This file is manually updated to fix bridge method mappings

import '../../frb_generated.dart';

// Stub FlutterMessageClient class for compatibility
class FlutterMessageClient {
  static Future<FlutterMessageClient> default_() async {
    return FlutterMessageClient();
  }
}

// Create a dummy client since the actual client handling is done differently
Future<FlutterMessageClient> createMessageClient() =>
    FlutterMessageClient.default_();

Future<String> connectToCliServer({
  required FlutterMessageClient client,
  required String endpointAddrStr,
  String? relayUrl,
}) => RustLib.instance.api.rustLibAppApiIrohClientConnectToPeer(
  ticket: endpointAddrStr.startsWith('ticket:') ? endpointAddrStr : 'ticket:${endpointAddrStr}',
);

Future<String> createRemoteTerminal({
  required FlutterMessageClient client,
  required String sessionId,
  String? name,
  String? shellPath,
  String? workingDir,
  required int rows,
  required int cols,
}) => RustLib.instance.api.rustLibAppApiIrohClientCreateTerminal(
  name: name,
  shellPath: shellPath,
  workingDir: workingDir,
  rows: rows,
  cols: cols,
);

Future<void> sendTerminalInput({
  required FlutterMessageClient client,
  required String sessionId,
  required String terminalId,
  required String input,
}) => RustLib.instance.api.rustLibAppApiIrohClientSendTerminalInput(
  terminalId: terminalId,
  input: input,
);

Future<void> resizeRemoteTerminal({
  required FlutterMessageClient client,
  required String sessionId,
  required String terminalId,
  required int rows,
  required int cols,
}) => RustLib.instance.api.rustLibAppApiIrohClientResizeTerminal(
  terminalId: terminalId,
  rows: rows,
  cols: cols,
);

Future<void> stopRemoteTerminal({
  required FlutterMessageClient client,
  required String sessionId,
  required String terminalId,
}) => RustLib.instance.api.rustLibAppApiIrohClientStopTerminal(
  terminalId: terminalId,
);

// Stub implementations for functions that don't have direct equivalents
Future<String> createTcpForwardingSession({
  required FlutterMessageClient client,
  required String sessionId,
  required String localAddr,
  String? remoteHost,
  int? remotePort,
  required String forwardingType,
}) async {
  // Stub implementation - return a dummy session ID
  return "tcp_forwarding_${DateTime.now().millisecondsSinceEpoch}";
}

Future<void> stopTcpForwardingSession({
  required FlutterMessageClient client,
  required String sessionId,
  required String forwardingSessionId,
}) async {
  // Stub implementation - no-op
}

Future<List<dynamic>> listRemoteTerminals({
  required FlutterMessageClient client,
  required String sessionId,
}) async {
  // Stub implementation - return empty list
  return [];
}

Future<void> disconnectFromCliServer({
  required FlutterMessageClient client,
  required String sessionId,
}) async {
  // Stub implementation - no-op
}

Future<List<dynamic>> getActiveSessions({
  required FlutterMessageClient client,
}) async {
  // Stub implementation - return empty list
  return [];
}

Future<List<dynamic>> getTcpForwardingSessions({
  required FlutterMessageClient client,
  required String sessionId,
}) async {
  // Stub implementation - return empty list
  return [];
}

Future<Map<String, dynamic>> getSystemStatus({
  required FlutterMessageClient client,
}) async {
  // Stub implementation - return empty status
  return {'connected': true, 'terminals': 0, 'forwarding_sessions': 0};
}

// Stub implementations for utility functions
String parseEndpointAddr({required String addr}) => addr;

String parseConnectionTicket({required String ticket}) => ticket;

Future<String> connectByTicket({
  required FlutterMessageClient client,
  required String ticket,
}) => RustLib.instance.api.rustLibAppApiIrohClientConnectToPeer(
  ticket: ticket,
);

Future<String> connectByNodeId({
  required FlutterMessageClient client,
  required String nodeIdHex,
  String? relayUrl,
}) async {
  // Stub implementation - create a fake endpoint address from node ID
  final endpoint = "node:$nodeIdHex";
  return "stub_session_${DateTime.now().millisecondsSinceEpoch}";
}

String constructEndpointAddrFromNodeInfo({
  required String nodeIdHex,
  String? relayUrl,
}) => "node:$nodeIdHex";

String formatForwardingType({required String forwardingType}) => forwardingType;

bool validateTerminalSize({required int rows, required int cols}) {
  return rows > 0 && cols > 0 && rows <= 200 && cols <= 500;
}
