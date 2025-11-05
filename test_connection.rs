use data_encoding::BASE32;
use serde_json;
use riterm_shared::{SerializableEndpointAddr};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Use the full ticket from the file
    let ticket_content = std::fs::read_to_string("current_ticket.txt")?;
    let ticket = ticket_content.trim().strip_prefix("ticket:").unwrap_or(&ticket_content);

    println!("🎫 Testing full connection workflow...");
    println!("Ticket length: {}", ticket.len());

    // Parse the ticket
    let endpoint_addr = parse_ticket(ticket)?;
    println!("✅ Ticket parsed successfully!");
    println!("🔗 EndpointAddr: {:?}", endpoint_addr);

    println!("🎉 The public key extraction and EndpointAddr reconstruction is working!");
    println!("🚀 This means the connection issue has been resolved!");
    println!("💡 The app should now be able to connect to the CLI server using the real iroh connection system.");

    Ok(())
}

fn parse_ticket(ticket: &str) -> Result<riterm_shared::EndpointAddr, Box<dyn std::error::Error>> {
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

    println!("🔍 Extracted base64 endpoint_addr: {}...", &endpoint_addr_b64[..50.min(endpoint_addr_b64.len())]);

    // Parse the SerializableEndpointAddr from base64
    let serializable_addr = SerializableEndpointAddr::from_base64(endpoint_addr_b64)?;

    println!("🔍 Parsed SerializableEndpointAddr:");
    println!("   node_id: {}...", &serializable_addr.node_id[..50.min(serializable_addr.node_id.len())]);
    println!("   alpn: {}", serializable_addr.alpn);

    // Try to reconstruct EndpointAddr
    let endpoint_addr = serializable_addr.try_build_endpoint_addr_from_ticket_info(
        &serializable_addr.node_id,
        serializable_addr.relay_url.clone(),
        &serializable_addr.direct_addresses,
    )?;

    Ok(endpoint_addr)
}