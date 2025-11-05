fn main() {
    let node_id_str = "EndpointAddr { id: PublicKey(c9d090156e45c6b65a26e086ce8bc45507e9229e8513b8992c083c9d14c8c682), addrs: {Ip(10.44.20.18:50584)} }";

    println!("原始字符串: {}", node_id_str);
    println!("字符串长度: {}", node_id_str.len());

    if let Some(start) = node_id_str.find("PublicKey(") {
        println!("找到 'PublicKey(' 在位置: {}", start);
        if let Some(end) = node_id_str.find(')', start) {
            println!("找到 ')' 在位置: {}", end);
            let key_str = &node_id_str[start+11..end];
            println!("提取的密钥: '{}'", key_str);
            println!("密钥长度: {}", key_str.len());
            println!("密钥内容: {:?}", key_str.as_bytes());

            // 检查是否缺少字符
            println!("前10个字符: {}", &key_str[..10.min(key_str.len())]);
            println!("后10个字符: {}", &key_str[key_str.len().saturating_sub(10)..]);

            // 检查原始字符串中的这个范围
            let original_range = &node_id_str[start..=end];
            println!("原始范围内的字符: '{}'", original_range);
        }
    }
}