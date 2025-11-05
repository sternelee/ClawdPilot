use data_encoding::BASE32;
use serde_json;

fn main() {
    let ticket = "PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXIIR2GE3TMMRSGM3DIOJZFQRGK3TEOBXWS3TUL5QWIZDSEI5CEZLZJJ2WEMSSNRMDE3DLJFVG62KSK42WWY2HHFYGE3SSIJNEOUTZJFEHGZ3BK5ITMSKGIIYVS3LYOBMTA5DMMVJWO52NGJITGTKEIJUFSMSKNNGVOVJRJYZEKMCNK5GXOTJSJEZVUR2JPFMWU3DJJ5LUS6KPK5ITGTLNIZWE22SKNNNEOVJQLFVGG6SNK5CTETTKJJVU6RDLPBHEIQTKJV5FK6KZPJVTCS2TO5TVSV2SNNRW4TJWJFEHISTDINTXQTKDGQYE4QZUPFGUGNDYJ5CG6MKOIRVTCTLZNQ4USSBQNFGEGSTZLJLXQ2DFKY4TCY3NO5UU63JVGFREO53TJFWVE4DDNVLGUZCGHFUFUR2SPFNFQTT2LJME22KPNR2GITCDJJUGESCCOVEWU33JLEZDS5CMNZFHAZCHKZ4WEUZVORNFQTT2LFLWI3DDPE4HQSLOGA6SELBCNZXWIZK7NFSCEORCKB2WE3DJMNFWK6JIGAZWINZQGBQWGYTEGFSTKN3BGQYWGMBTMI3WIYRSMI4WEOLCGI4WINZSMFSTEMTEMRSTIYRXGMYWCNRWGJSDQOJRGQYGGMZVGJRTSNJJEIWCE4TFNRQXSX3VOJWCEOTOOVWGY7I=";

    // 解析票据
    let ticket_json_bytes = BASE32.decode(ticket.as_bytes()).unwrap();
    let ticket_json = String::from_utf8(ticket_json_bytes).unwrap();
    let ticket_data: serde_json::Value = serde_json::from_str(&ticket_json).unwrap();

    println!("🎫 票据解析结果:");
    println!("Node ID: {}", ticket_data["node_id"]);
    println!("Endpoint Addr: {}", ticket_data["endpoint_addr"]);

    // 解析端点地址
    let endpoint_addr_b64 = ticket_data["endpoint_addr"].as_str().unwrap();
    let engine = base64::engine::general_purpose::STANDARD;
    let endpoint_bytes = engine.decode(endpoint_addr_b64).unwrap();
    let endpoint_json = String::from_utf8(endpoint_bytes).unwrap();
    let endpoint_data: serde_json::Value = serde_json::from_str(&endpoint_json).unwrap();

    println!("\n🔍 端点地址详情:");
    println!("Raw node_id: {}", endpoint_data["node_id"]);
    println!("Direct addresses: {:?}", endpoint_data["direct_addresses"]);
    println!("ALPN: {}", endpoint_data["alpn"]);

    // 尝试解析 PublicKey
    if let Some(node_id_str) = endpoint_data["node_id"].as_str() {
        if let Some(start) = node_id_str.find("PublicKey(") {
            if let Some(end) = node_id_str.find(')', start) {
                let key_str = &node_id_str[start+11..end];
                println!("Extracted key: {}", key_str);

                // 尝试解码为 hex
                if let Ok(key_bytes) = hex::decode(key_str) {
                    println!("Key bytes length: {}", key_bytes.len());
                    println!("Key bytes: {:?}", key_bytes);
                }
            }
        }
    }
}