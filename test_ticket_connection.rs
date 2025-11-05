use data_encoding::BASE32;
use serde_json;
use riterm_shared::{SerializableEndpointAddr};

fn main() {
    // Sample ticket from the CLI output
    let ticket = "PMRGC3DQNY5CEORCOJUXIZLSNVPXC5LJMMRCYITDOJSWC5DFMRPWC5BCHIYTONRSGMYTMMRVGYWCEZLOMRYG62LOORPWCZDEOIRDUITFPFFHKYRSKJWFQMTMNNEWU33JKJLTK23DI44XAYTOKJBFUR2SPFEUQ43HMFLVCNSJIZBDCWLNPBYFSMDUNRSVG2DLLJLUU2CPIRSGUWLNKZWVSMSNO5MW2TLYLFVE2MSZNVJGWTJSJF4E22SRO5NEOWJSJZKES6S2NVEXOTSXJU2VS6SVPFGVOSLZJ5CFCMK2K5JGQWSEJZUFS2S2NFMW2SL2JV5GGMSLKN3WOWKXKJVWG3SNGZEUQ5CKMNBWO6CNIM2DATSDGR4U2QZUPBHUI3ZRJVCE2MCPINVXGSKFNR3UWRCFGVGWSNDYJZVGO5KNKRGTKTDKJU3E4VCBPJHEIZ3QJRBUESTDINTXQT2UJF2U2VCZGRGGUSLYJZJTI52PNJKXOTL2KE2EWWBQM5TFGSLTJFXEU3DCI5DDKWBTKZ4WEQ2JGZRG4VTTMJBXO2K2I5WHSWSXJYYFQMSGNNNEQSTMMMZU43DDPFETMVZRGBZUS3KGONRUONDJJ5UUU2TCGIYHKY3NNQYFUWCKORGG2MLMMMZU42C2GJLHUTD2IVUWMUJ5HURCYITON5SGKX3JMQRDUISQOVRGY2LDJNSXSKDEMVRGCOBXMNRGKZTDMMYGEYZRMIZTMYTEMQZWEMJSGQYGIZRWGUZDGZTCGA2WGOLDGUZDCYRSHA2DKZLEMFSDGYLCGZRGEYRTGM3TMKJCFQRHEZLMMF4V65LSNQRDU3TVNRWH2";

    println!("🎫 Testing ticket parsing...");
    println!("Ticket length: {}", ticket.len());

    // Parse the ticket
    match parse_ticket(ticket) {
        Ok(endpoint_addr) => {
            println!("✅ Ticket parsed successfully!");
            println!("EndpointAddr: {:?}", endpoint_addr);
        }
        Err(e) => {
            println!("❌ Failed to parse ticket: {}", e);
        }
    }
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