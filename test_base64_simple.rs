// 简单的 Rust base64 测试
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TestData {
    node_id: String,
    direct_addresses: Vec<String>,
    alpn: String,
}

fn is_valid_base64(s: &str) -> bool {
    // 先清理空白字符，然后检查剩余字符是否有效
    let cleaned = s.chars().filter(|c| !c.is_whitespace()).collect::<String>();
    if cleaned.is_empty() {
        return false;
    }

    // 检查长度是否是4的倍数（base64 要求）
    if cleaned.len() % 4 != 0 {
        return false;
    }

    // 检查字符是否有效
    cleaned.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=')
}

fn main() {
    println!("Testing base64 encoding/decoding...");

    let test_data = TestData {
        node_id: "test_node_123".to_string(),
        direct_addresses: vec!["127.0.0.1:8080".to_string()],
        alpn: "riterm_quic".to_string(),
    };

    // JSON 序列化
    let json = serde_json::to_string(&test_data).unwrap();
    println!("JSON: {}", json);

    // Base64 编码
    let engine = base64::engine::general_purpose::STANDARD;
    let encoded = engine.encode(json.as_bytes());
    println!("Base64: {}", encoded);

    // 验证
    println!("Is valid base64: {}", is_valid_base64(&encoded));

    // 解码
    match engine.decode(&encoded) {
        Ok(decoded) => {
            let json_decoded = String::from_utf8(decoded).unwrap();
            println!("Decoded JSON: {}", json_decoded);

            match serde_json::from_str::<TestData>(&json_decoded) {
                Ok(data) => {
                    println!("Decoded data: {:?}", data);
                    println!("✅ Roundtrip successful!");
                }
                Err(e) => {
                    println!("❌ JSON parse failed: {}", e);
                }
            }
        }
        Err(e) => {
            println!("❌ Base64 decode failed: {}", e);
        }
    }

    // 测试有问题的字符串
    println!("\nTesting problematic strings...");
    let problematic = "eyJub2RlX2lkIjoidGVzd CJ9"; // 包含空格
    println!("Problematic: {}", problematic);
    println!("Is valid: {}", is_valid_base64(problematic));

    // 清理后测试
    let cleaned = problematic.chars().filter(|c| !c.is_whitespace()).collect::<String>();
    println!("Cleaned: {}", cleaned);
    println!("Cleaned is valid: {}", is_valid_base64(&cleaned));
}