use data_encoding::BASE32;
use serde_json;
use base64::Engine as _;

fn main() {
    let ticket = "PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXIIR2GE3TMMRSGM3TAMZWFQRGK3TEOBXWS3TUL5QWIZDSEI5CEZLZJJ2WEMSSNRMDE3DLJFVG62KSK42WWY2HHFYGE3SSIJNEOUTZJFEHGZ3BK5ITMSKGIIYVS3LYOBMTA5DMMVJWQ22ZKRGXOWJSIUZU4VCKNJHHUQJSJVVFK6SZGJHGSTSUM54E4VC2NVMVOWLZLF5GY2C2K5MXQWSUJZVU4MSONFGXUVLYLFKGWMCNKRIXOTSXKUYE46SVGJNGUTLZJZVEK6K2KRSGWS2TO5TVSV2SNNRW4TJWJFEHISTDINTXQTKDGQYE4QZUPFGUGNDYJ5CG6MSOKRGTATLJNQ4USSBQNFGEGSTZLJLXQ2DFKY4TCY3NO5UU63JVGFREO53TJFWVE4DDNVLGUZCGHFUFUR2SPFNFQTT2LJME22KPNR2GITCDJJUGESCCOVEWU33JLEZDS5CMNZFHAZCHKZ4WEUZVORNFQTT2LFLWI3DDPE4HQSLOGA6SELBCNZXWIZK7NFSCEORCKB2WE3DJMNFWK6JIMRQTGMDDME3TKMTDG4YDMMRVGNRWGYRVHAYTKNTGMFTDEYZZMFSWMMLFGNSDOY3CGM2TCYJZGQYTIMBVMU2DONJWMYZTENRRGJSTOZBJEIWCE4TFNRQXSX3VOJWCEOTOOVWGY7I=";

    println!("🔍 调试连接票据解析和 EndpointAddr 重建...");

    // 1. 解析外层票据
    let ticket_json_bytes = BASE32.decode(ticket.as_bytes()).unwrap();
    let ticket_json = String::from_utf8(ticket_json_bytes).unwrap();
    let ticket_data: serde_json::Value = serde_json::from_str(&ticket_json).unwrap();

    println!("✅ 外层票据解析成功");
    println!("Node ID: {}", ticket_data["node_id"]);

    let endpoint_addr_b64 = ticket_data["endpoint_addr"].as_str().unwrap();
    println!("Endpoint Addr (base64): {}", endpoint_addr_b64);

    // 2. 解析内层端点地址
    let engine = base64::engine::general_purpose::STANDARD;
    let endpoint_bytes = engine.decode(endpoint_addr_b64).unwrap();
    let endpoint_json = String::from_utf8(endpoint_bytes).unwrap();
    let endpoint_data: serde_json::Value = serde_json::from_str(&endpoint_json).unwrap();

    println!("✅ 内层端点地址解析成功");
    println!("Raw node_id: {}", endpoint_data["node_id"]);
    println!("Direct addresses: {:?}", endpoint_data["direct_addresses"]);
    println!("ALPN: {}", endpoint_data["alpn"]);

    // 3. 尝试提取 PublicKey
    let node_id_str = endpoint_data["node_id"].as_str().unwrap();
    println!("\n🔑 尝试解析 PublicKey...");
    println!("原始字符串: {}", node_id_str);

    if let Some(start) = node_id_str.find("PublicKey(") {
        if let Some(end) = node_id_str.find(')') {
            let key_str = &node_id_str[start+11..end];
            println!("提取的密钥字符串: {}", key_str);
            println!("密钥长度: {}", key_str.len());

            // 尝试解码为 hex
            match hex::decode(key_str) {
                Ok(key_bytes) => {
                    println!("✅ Hex 解码成功，字节数: {}", key_bytes.len());

                    if key_bytes.len() == 32 {
                        println!("✅ 密钥长度正确 (32 字节)");

                        let mut key_array = [0u8; 32];
                        key_array.copy_from_slice(&key_bytes);

                        // 尝试创建 iroh PublicKey
                        match iroh::PublicKey::from_bytes(&key_array) {
                            Ok(public_key) => {
                                println!("✅ iroh PublicKey 创建成功: {:?}", public_key);

                                // 尝试创建 EndpointAddr
                                match iroh::EndpointAddr::new(public_key) {
                                    Ok(endpoint_addr) => {
                                        println!("✅ EndpointAddr 创建成功: {:?}", endpoint_addr);
                                        return;
                                    }
                                    Err(e) => {
                                        println!("❌ EndpointAddr 创建失败: {}", e);
                                    }
                                }
                            }
                            Err(e) => {
                                println!("❌ iroh PublicKey 创建失败: {}", e);
                            }
                        }
                    } else {
                        println!("❌ 密钥长度错误，期望 32 字节，实际 {}", key_bytes.len());
                    }
                }
                Err(e) => {
                    println!("❌ Hex 解码失败: {}", e);
                }
            }
        } else {
            println!("❌ 找不到 PublicKey 结束括号");
        }
    } else {
        println!("❌ 找不到 PublicKey 开始标记");
    }

    println!("\n❌ EndpointAddr 重建失败，这将导致占位符连接");
}