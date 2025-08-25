//! 测试终端配置广播功能

use cli::terminal_config::TerminalConfigDetector;
use serde_json;

fn main() -> anyhow::Result<()> {
    println!("🧪 Testing terminal configuration detection and serialization...");
    
    // 测试配置检测
    match TerminalConfigDetector::detect_full_config() {
        Ok(config) => {
            println!("✅ Successfully detected terminal configuration");
            
            // 测试JSON序列化
            match serde_json::to_value(&config) {
                Ok(config_data) => {
                    println!("✅ Successfully serialized configuration to JSON");
                    println!("📋 Configuration summary:");
                    println!("   Terminal: {}", config.terminal_type);
                    println!("   Shell: {} ({})", config.shell_config.shell_type, config.shell_config.shell_path);
                    println!("   Size: {}x{}", config.terminal_size.width, config.terminal_size.height);
                    println!("   OS: {} ({})", config.system_info.os, config.system_info.arch);
                    
                    // 打印JSON数据（前几行）
                    if let Ok(config_str) = serde_json::to_string_pretty(&config_data) {
                        let lines: Vec<&str> = config_str.lines().take(10).collect();
                        println!("\n📊 JSON preview (first 10 lines):");
                        for line in lines {
                            println!("   {}", line);
                        }
                        if config_str.lines().count() > 10 {
                            println!("   ... (truncated)");
                        }
                    }
                    
                    println!("\n🎉 All tests passed! Terminal configuration can be broadcast successfully.");
                }
                Err(e) => {
                    eprintln!("❌ Failed to serialize configuration: {}", e);
                    return Err(e.into());
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to detect terminal configuration: {}", e);
            return Err(e);
        }
    }
    
    Ok(())
}