use data_encoding::BASE32;
use serde_json;
use riterm_shared::SerializableEndpointAddr;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let ticket_content = std::fs::read_to_string("current_ticket.txt")?;
    let ticket = ticket_content.trim().strip_prefix("ticket:").unwrap_or(&ticket_content);

    // Remove "ticket:" prefix if present
    let cleaned = ticket.strip_prefix("ticket:").unwrap_or(ticket);

    // Decode base32
    let ticket_json_bytes = BASE32.decode(cleaned.as_bytes())?;
    let ticket_json = String::from_utf8(ticket_json_bytes)?;

    // Parse JSON
    let ticket_data: serde_json::Value = serde_json::from_str(&ticket_json)?;

    // Extract endpoint_addr
    let endpoint_addr_b64 = ticket_data.get("endpoint_addr")
        .and_then(|v| v.as_str())
        .ok_or("Missing endpoint_addr in ticket")?;

    let serializable_addr = SerializableEndpointAddr::from_base64(endpoint_addr_b64)?;

    println!("🔍 Direct addresses in ticket:");
    for (i, addr) in serializable_addr.direct_addresses.iter().enumerate() {
        println!("   {}: {}", i + 1, addr);
    }

    if serializable_addr.direct_addresses.is_empty() {
        println!("   ❌ No direct addresses found!");
    } else {
        println!("   ✅ Found {} direct addresses", serializable_addr.direct_addresses.len());
    }

    println!("\n🔍 Node ID: {}", &serializable_addr.node_id[..100.min(serializable_addr.node_id.len())]);
    println!("🔍 ALPN: {}", serializable_addr.alpn);

    Ok(())
}
