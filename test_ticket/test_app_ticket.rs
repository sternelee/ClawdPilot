use data_encoding::BASE32;
use serde_json;
use base64::Engine as _;

fn parse_ticket_node_info(ticket: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Remove "ticket:" prefix
    let encoded = ticket.strip_prefix("ticket:")
        .ok_or("Invalid ticket format")?;

    // Decode base32
    let ticket_json_bytes = BASE32.decode(encoded.as_bytes())?;
    let ticket_json = String::from_utf8(ticket_json_bytes)?;

    // Parse JSON
    let ticket_data: serde_json::Value = serde_json::from_str(&ticket_json)?;

    // Extract node information
    let node_id = ticket_data.get("node_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing node_id in ticket")?;

    let endpoint_addr_b64 = ticket_data.get("endpoint_addr")
        .and_then(|v| v.as_str())
        .ok_or("Missing endpoint_addr in ticket")?;

    let created_at = ticket_data.get("created_at")
        .and_then(|v| v.as_u64())
        .ok_or("Missing created_at in ticket")?;

    println!("Node ID: {}", node_id);
    println!("Endpoint Addr (base64): {}", endpoint_addr_b64);
    println!("Created At: {}", created_at);

    // Now test the SerializableEndpointAddr parsing
    test_serializable_endpoint_addr(endpoint_addr_b64)?;

    Ok(())
}

fn test_serializable_endpoint_addr(b64_str: &str) -> Result<(), Box<dyn std::error::Error>> {
    println!("Testing SerializableEndpointAddr parsing...");
    println!("Input string length: {}", b64_str.len());
    println!("Input string: {}", b64_str);

    // Check for invalid characters (similar to our Rust implementation)
    let valid_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let invalid_chars: Vec<char> = b64_str.chars()
        .filter(|c| !valid_chars.contains(*c))
        .collect();

    if !invalid_chars.is_empty() {
        println!("❌ Found invalid characters: {:?}", invalid_chars);
        return Err(format!("Invalid characters found: {:?}", invalid_chars).into());
    }

    // Check length
    if b64_str.len() % 4 != 0 {
        println!("❌ Length is not a multiple of 4: {}", b64_str.len());
        return Err(format!("Length not multiple of 4: {}", b64_str.len()).into());
    }

    // Try base64 decode (using new API)
    let engine = base64::engine::general_purpose::STANDARD;

    match engine.decode(b64_str) {
        Ok(decoded) => {
            let decoded: Vec<u8> = decoded;
            println!("✅ Base64 decode successful, {} bytes", decoded.len());

            let json_str = String::from_utf8(decoded)?;
            println!("✅ UTF-8 decode successful");
            println!("JSON: {}", json_str);

            let endpoint_data: serde_json::Value = serde_json::from_str(&json_str)?;
            println!("✅ JSON parse successful");
            println!("Endpoint data: {}", serde_json::to_string_pretty(&endpoint_data)?);

            Ok(())
        }
        Err(e) => {
            println!("❌ Base64 decode failed: {}", e);
            Err(format!("Base64 decode failed: {}", e).into())
        }
    }
}

fn main() {
    let ticket = "PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXIIR2GE3TMMRSGM2TSMBUFQRGK3TEOBXWS3TUL5QWIZDSEI5CEZLZJJ2WEMSSNRMDE3DLJFVG62KSK42WWY2HHFYGE3SSIJNEOUTZJFEHGZ3BK5ITMSKGIIYVS3LYOBMTA5DMMVJWONKOKRWGSWSENRUFSVCWNRGXUZ3ZJVLVS6CZPJJG2TSHLJUVUVCZGFNG2UTMJ5KE43CNK5ITCTL2MN5E2RCKNRHDEULYJVVECNKZPJUGYT2ELF5E2MSWNFNEOTJSLF5FC52ZNJEXSS2TO5TVSV2SNNRW4TJWJFEHISTDINTXQTKDGQYE4QZUPFGUGNDYJ5CG6MSNNJGXOTLJNQ4USSBQNFGEGSTZLJLXQ2DFKY4TCY3NO5UU63JVGFREO53TJFWVE4DDNVLGUZCGHFUFUR2SPFNFQTT2LJME22KPNR2GITCDJJUGESCCOVEWU33JLEZDS5CMNZFHAZCHKZ4WEUZVORNFQTT2LFLWI3DDPE4HQSLOGA6SELBCNZXWIZK7NFSCEORCKB2WE3DJMNFWK6JIHE2TSYTEHFQWCNLFGM4DEMLGGFRTIZRUMZRGKNRVMZSGKOJTMUYWINJTG4ZTAMTFG5SDCMRQHFRTQZJYGYZTGZLCMRRTMYZUGBRDEMRJEIWCE4TFNRQXSX3VOJWCEOTOOVWGY7I=";

    println!("Testing app ticket parsing with full ticket...");

    match parse_ticket_node_info(&format!("ticket:{}", ticket)) {
        Ok(()) => {
            println!("🎉 Full ticket parsing successful!");
        }
        Err(e) => {
            println!("❌ Ticket parsing failed: {}", e);
        }
    }
}