use data_encoding::BASE32;
use serde_json;

fn main() {
    let ticket = "PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXIIR2GE3TMMRSGM2TGOJQFQRGK3TEOBXWS3TUL5QWIZDSEI5CEZLZJJ2WEMSSNRMDE3DLJFVG62KSK42WWY2HHFYGE3SSIJNEOUTZJFEHGZ3BK5ITMSKGIIYVS3LYOBMTA5DMMVJWOMCZPJGXST2UMRWU2V2RO5NEI2DNJZVGWM2NNVMTGTLKJE2U2R2VGJNEOUJSJVVFKMK2I5CXSWTNLJWE6VCBGNMVIVJQJVVGG6CNI5IXOTLNJV4VS6SKNNNGUWLZJ5KFS52OPJFG2S2TO5TVSV2SNNRW4TJWJFEHISTDINTXQTKDGQYE4QZUPFGUGNDYJ5CG6MKNNJVTCT2TNQ4USSBQNFGEGSTZLJLXQ2DFKY4TCY3NO5UU63JVGFREO53TJFWVE4DDNVLGUZCGHFUFUR2SPFNFQTT2LJME22KPNR2GITCDJJUGESCCOVEWU33JLEZDS5CMNZFHAZCHKZ4WEUZVORNFQTT2LFLWI3DDPE4HQSLOGA6SELBCNZXWIZK7NFSCEORCKB2WE3DJMNFWK6JIGRRTGMRZG5TDCZBQMQ4GMNRZG4ZGMNZSGI4TAZJWMRSDMMRVGVSGCMTGMZSTSMBXME2TIMRXGEYGIMBSMMZGGMTEMY3DEOJWGA3TEZRJEIWCE4TFNRQXSX3VOJWCEOTOOVWGY7I=";

    println!("Testing ticket parsing with Rust...");
    println!("Ticket length: {}", ticket.len());

    // 尝试 base32 解码
    match BASE32.decode(ticket.as_bytes()) {
        Ok(ticket_json_bytes) => {
            println!("✅ Base32 decode successful, {} bytes", ticket_json_bytes.len());

            match String::from_utf8(ticket_json_bytes) {
                Ok(ticket_json) => {
                    println!("✅ UTF-8 decode successful");
                    println!("JSON: {}", ticket_json);

                    match serde_json::from_str::<serde_json::Value>(&ticket_json) {
                        Ok(ticket_data) => {
                            println!("✅ JSON parse successful");

                            if let Some(endpoint_addr_b64) = ticket_data.get("endpoint_addr").and_then(|v| v.as_str()) {
                                println!("Endpoint addr (base64): {}", endpoint_addr_b64);
                                println!("Endpoint addr length: {}", endpoint_addr_b64.len());

                                // 现在测试 base64 解码
                                match base64::decode(endpoint_addr_b64) {
                                    Ok(decoded) => {
                                        println!("✅ Base64 decode successful, {} bytes", decoded.len());

                                        match String::from_utf8(decoded) {
                                            Ok(json_str) => {
                                                println!("✅ UTF-8 decode successful");
                                                println!("Inner JSON: {}", json_str);

                                                match serde_json::from_str::<serde_json::Value>(&json_str) {
                                                    Ok(endpoint_data) => {
                                                        println!("✅ Endpoint JSON parse successful");
                                                        println!("Endpoint data: {}", serde_json::to_string_pretty(&endpoint_data).unwrap());
                                                    }
                                                    Err(e) => {
                                                        println!("❌ Endpoint JSON parse failed: {}", e);
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                println!("❌ UTF-8 decode failed: {}", e);
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        println!("❌ Base64 decode failed: {}", e);
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            println!("❌ JSON parse failed: {}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("❌ UTF-8 decode failed: {}", e);
                }
            }
        }
        Err(e) => {
            println!("❌ Base32 decode failed: {}", e);
        }
    }
}