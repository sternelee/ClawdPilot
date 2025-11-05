#!/usr/bin/env python3
"""
Test script to validate base64 encoding/decoding as implemented in RiTerm
"""
import base64
import json
import sys

def test_base64_roundtrip():
    """Test the base64 encoding/decoding that RiTerm uses"""

    # Simulate the SerializableEndpointAddr data structure
    test_data = {
        "node_id": "test_node_12345",
        "relay_url": None,
        "direct_addresses": ["127.0.0.1:8080", "192.168.1.100:8080"],
        "alpn": "riterm_quic"
    }

    print("Testing RiTerm base64 encoding/decoding...")
    print(f"Original data: {test_data}")

    # Step 1: JSON encode (simulating serde_json::to_vec)
    json_bytes = json.dumps(test_data).encode('utf-8')
    print(f"JSON bytes length: {len(json_bytes)}")

    # Step 2: Base64 encode (simulating SerializableEndpointAddr::to_base64)
    base64_encoded = base64.b64encode(json_bytes).decode('utf-8')
    print(f"Base64 encoded: {base64_encoded}")
    print(f"Base64 length: {len(base64_encoded)}")

    # Validate base64 characters (simulating is_valid_base64)
    valid_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
    is_valid = all(c in valid_chars for c in base64_encoded)
    print(f"Contains only valid base64 chars: {is_valid}")

    if not is_valid:
        print("❌ Invalid characters found in base64 string!")
        return False

    # Step 3: Base64 decode (simulating SerializableEndpointAddr::from_base64)
    try:
        decoded_bytes = base64.b64decode(base64_encoded, validate=True)
        print(f"Successfully decoded {len(decoded_bytes)} bytes")
    except Exception as e:
        print(f"❌ Base64 decode failed: {e}")
        return False

    # Step 4: JSON decode
    try:
        decoded_data = json.loads(decoded_bytes.decode('utf-8'))
        print(f"Decoded data: {decoded_data}")
    except Exception as e:
        print(f"❌ JSON decode failed: {e}")
        return False

    # Step 5: Verify roundtrip
    if test_data == decoded_data:
        print("✅ Roundtrip successful!")
        return True
    else:
        print("❌ Roundtrip failed - data mismatch!")
        return False

def test_problematic_base64():
    """Test various problematic base64 strings"""

    print("\nTesting problematic base64 strings...")

    # Test cases that might cause "Invalid symbol 32, offset 12" error
    test_cases = [
        # Normal base64
        "eyJub2RlX2lkIjoidGVzdF9ub2RlXzEyMzQ1IiwicmVsYXlfdXJsIjpudWxsLCJkaXJlY3RfYWRkcmVzc2VzIjpbIjEyNy4wLjAuMTo4MDgwIiwiMTkyLjE2OC4xLjEwMDo4MDgwIl0sImFscG4iOiJyaXRlcm1fcXVpYyJ9",

        # Base64 with padding issues
        "eyJub2RlX2lkIjoidGVzdCJ9",

        # Base64 with newline (might cause issues)
        "eyJub2RlX2lkIjoidGVzdCJ9\n",

        # Base64 with spaces
        "eyJub2RlX2lkIjoidGVzdCJ9 ",

        # Invalid base64 (symbol 32 is space)
        "eyJub2RlX2lkIjoidGVzd CJ9",  # Space in middle
    ]

    for i, test_case in enumerate(test_cases):
        print(f"\nTest case {i+1}: {repr(test_case)}")

        # Check for invalid characters
        valid_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
        invalid_chars = [c for c in test_case if c not in valid_chars]

        if invalid_chars:
            print(f"  ❌ Invalid characters: {invalid_chars}")
        else:
            print("  ✅ All characters valid")

        # Try decode
        try:
            # Clean the string first (remove whitespace)
            clean_str = ''.join(test_case.split())
            if clean_str != test_case:
                print(f"  📝 Cleaned whitespace: {repr(clean_str)}")

            decoded = base64.b64decode(clean_str, validate=True)
            print(f"  ✅ Decode successful: {len(decoded)} bytes")
        except Exception as e:
            print(f"  ❌ Decode failed: {e}")

def test_ticket_structure():
    """Test the full ticket structure that RiTerm uses"""

    print("\nTesting full RiTerm ticket structure...")

    # Simulate the ticket data structure
    ticket_data = {
        "node_id": "NodeId(0123456789abcdef0123456789abcdef01234567)",
        "endpoint_addr": "eyJub2RlX2lkIjoidGVzdF9ub2RlXzEyMzQ1IiwicmVsYXlfdXJsIjpudWxsLCJkaXJlY3RfYWRkcmVzc2VzIjpbIjEyNy4wLjAuMTo4MDgwIiwiMTkyLjE2OC4xLjEwMDo4MDgwIl0sImFscG4iOiJyaXRlcm1fcXVpYyJ9",
        "relay_url": None,
        "alpn": "riterm_quic",
        "created_at": 1699123456
    }

    print(f"Ticket data: {ticket_data}")

    # JSON encode
    ticket_json = json.dumps(ticket_data).encode('utf-8')

    # Base32 encode (simulating the outer ticket encoding)
    try:
        import base64
        # Python's base64 has base32 functions
        ticket_b32 = base64.b32encode(ticket_json).decode('utf-8')
        print(f"Full ticket (base32): ticket:{ticket_b32}")

        # Test decode
        decoded_ticket = base64.b32decode(ticket_b32)
        ticket_json_back = decoded_ticket.decode('utf-8')
        ticket_data_back = json.loads(ticket_json_back)

        if ticket_data == ticket_data_back:
            print("✅ Full ticket roundtrip successful!")
            return True
        else:
            print("❌ Ticket roundtrip failed!")
            return False

    except Exception as e:
        print(f"❌ Ticket encoding/decoding failed: {e}")
        return False

if __name__ == "__main__":
    print("RiTerm Base64 Validation Test")
    print("=" * 40)

    success = True

    # Run tests
    success &= test_base64_roundtrip()
    test_problematic_base64()
    success &= test_ticket_structure()

    print("\n" + "=" * 40)
    if success:
        print("🎉 All critical tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1)