use anyhow::{Context, Result};
use clap::Parser;

use crate::local_terminal_manager::LocalTerminalManager;
use riterm_shared::P2PNetwork;

#[derive(Parser)]
#[command(name = "iroh-code-remote")]
#[command(about = "A terminal host for remote P2P management")]
pub struct Cli {
    #[arg(
        long,
        help = "Custom relay server URL (e.g., https://relay.example.com)"
    )]
    pub relay: Option<String>,

    #[arg(long, help = "Authentication token for ticket submission")]
    pub auth: Option<String>,
}

pub struct CliApp {
    network: P2PNetwork,
    terminal_manager: LocalTerminalManager,
}

impl CliApp {
    pub async fn new(relay: Option<String>) -> Result<Self> {
        let network = P2PNetwork::new(relay)
            .await
            .context("Failed to initialize P2P network")?;

        let terminal_manager = LocalTerminalManager::new();

        Ok(Self {
            network,
            terminal_manager,
        })
    }

    pub async fn run(&mut self, _cli: Cli) -> Result<()> {
        self.start_terminal_host().await
    }

    /// 启动终端主机模式 - 创建P2P会话并管理本地终端
    async fn start_terminal_host(&mut self) -> Result<()> {
        use riterm_shared::SessionHeader;
        use tracing::info;

        println!("🚀 Starting Terminal Host Mode...");
        println!("📡 Creating P2P session...");

        // 创建会话头信息
        let header = SessionHeader {
            version: 2,
            width: 80,
            height: 24,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            title: Some("Riterm Terminal Host".to_string()),
            command: None,
            session_id: format!("host_{}", uuid::Uuid::new_v4()),
        };

        // 创建共享会话
        let (topic_id, sender, input_receiver) = self
            .network
            .create_shared_session(header.clone())
            .await
            .context("Failed to create shared session")?;

        println!("✅ P2P session created successfully");
        println!("🎫 Generating session ticket...");

        // 创建会话票据
        let ticket = self
            .network
            .create_session_ticket(topic_id, &header.session_id)
            .await
            .context("Failed to create session ticket")?;

        println!("✅ Session ticket generated successfully");
        println!();
        println!("📊 Host Status:");
        println!("   🔗 Node ID: {}", &self.network.get_node_id().await[..16]);
        println!("   📡 Session ID: {}", header.session_id);
        println!("   🛠️  Local terminal management capabilities enabled");
        println!();

        // 显示ticket信息
        println!("🎫 === SESSION TICKET ===");
        println!("{}", ticket);
        println!("========================");
        println!();
        println!("💡 Share this ticket with remote users to allow them to connect");
        println!("💡 Remote users can scan the QR code or copy the ticket text");
        println!("⚠️  Press Ctrl+C to stop the host");

        // 设置终端管理器的P2P会话
        self.terminal_manager
            .set_p2p_session(
                self.network.clone(),
                header.session_id.clone(),
                sender.clone(),
            )
            .await;

        // 启动消息处理器来处理远程指令
        let session_id_clone = header.session_id.clone();

        tokio::spawn(async move {
            let mut receiver = input_receiver;
            while let Some(input) = receiver.recv().await {
                info!("Received input: {}", input);
                // 处理来自远程端的输入
                // 这里可以扩展为处理终端管理指令
            }
        });

        // 启动P2P消息处理器
        tokio::spawn(async move {
            // 这里可以添加更复杂的消息处理逻辑
            info!(
                "P2P message handler started for session: {}",
                session_id_clone
            );
        });

        // 保持主机运行直到用户中断
        tokio::signal::ctrl_c().await?;
        println!("\n👋 Terminal Host stopped");

        Ok(())
    }

    pub fn print_banner() {
        use crossterm::{
            cursor, execute,
            style::{Color, Print, ResetColor, SetForegroundColor},
            terminal::{Clear, ClearType},
        };
        use std::io;

        execute!(
            io::stdout(),
            Clear(ClearType::All),
            cursor::MoveTo(0, 0),
            SetForegroundColor(Color::Blue),
            Print("╭─────────────────────────────────────────────╮\n"),
            Print("│         🖥️  Riterm Terminal Manager            │\n"),
            Print("│     P2P Remote Terminal Management          │\n"),
            Print("╰─────────────────────────────────────────────╯\n"),
            ResetColor,
            Print("\n")
        )
        .ok();
    }
}
