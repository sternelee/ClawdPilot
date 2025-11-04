#!/bin/bash

# Flutter App ??????
# ??: ./debug_connection.sh

echo "==================================="
echo "RiTerm ??????"
echo "==================================="
echo ""

# ??????????
if [ ! -d "app" ] || [ ! -d "cli" ]; then
    echo "??: ????????????"
    exit 1
fi

# ??????
export RUST_LOG=debug,iroh=debug,quic=debug

echo "? ??? RUST_LOG=$RUST_LOG"
echo ""

# ????
echo "?????:"
echo "1) ?? CLI ??????????"
echo "2) ?? Flutter App???????"
echo "3) ?? Flutter ????"
echo "4) ?? Ticket ??"
echo "5) ???????"
echo ""
read -p "????? (1-5): " choice

case $choice in
    1)
        echo ""
        echo "?? CLI ???..."
        echo "?????? Connection Ticket"
        echo "==================================="
        cd cli
        cargo run -- host 2>&1 | tee ../cli_debug.log
        ;;
    2)
        echo ""
        echo "?? Flutter App..."
        echo "==================================="
        cd app
        flutter run 2>&1 | tee ../flutter_debug.log
        ;;
    3)
        echo ""
        echo "?? Flutter ????..."
        echo "? Ctrl+C ??"
        echo "==================================="
        flutter logs | grep -E "Connection|Ticket|Error|Step|===|Flutter:|Rust:"
        ;;
    4)
        echo ""
        read -p "??? Ticket: " ticket
        echo ""
        echo "?? Ticket ??..."
        echo "==================================="
        
        # ???? Rust ????
        cat > /tmp/test_ticket.rs << 'EOF'
use data_encoding::BASE32;
use serde_json;

fn main() {
    let ticket = std::env::args().nth(1).expect("Please provide ticket");
    
    if !ticket.starts_with("ticket:") {
        eprintln!("? Ticket must start with 'ticket:'");
        std::process::exit(1);
    }
    
    let encoded_data = &ticket[7..];
    println!("Encoded data length: {}", encoded_data.len());
    
    match BASE32.decode(encoded_data.as_bytes()) {
        Ok(decoded_data) => {
            println!("? Base32 decode successful");
            println!("Decoded length: {}", decoded_data.len());
            
            match serde_json::from_slice::<serde_json::Value>(&decoded_data) {
                Ok(ticket_data) => {
                    println!("? JSON parse successful");
                    println!("\nTicket data:");
                    println!("{}", serde_json::to_string_pretty(&ticket_data).unwrap());
                    
                    if ticket_data.get("node_id").is_some() {
                        println!("\n? node_id field present");
                    } else {
                        println!("\n? Missing node_id field");
                    }
                    
                    if ticket_data.get("alpn").is_some() {
                        println!("? alpn field present");
                    } else {
                        println!("? alpn field missing");
                    }
                    
                    println!("\n? Ticket is valid!");
                }
                Err(e) => {
                    eprintln!("? Failed to parse JSON: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            eprintln!("? Failed to decode Base32: {}", e);
            std::process::exit(1);
        }
    }
}
EOF
        
        # ?? Rust ????
        echo "?? Rust ?? Ticket..."
        cd /tmp
        if command -v rustc &> /dev/null; then
            rustc test_ticket.rs -o test_ticket 2>/dev/null
            if [ $? -eq 0 ]; then
                ./test_ticket "$ticket"
            else
                echo "???????????..."
                echo "Ticket ??: ${#ticket}"
                if [[ $ticket == ticket:* ]]; then
                    echo "? Ticket ?????? 'ticket:' ???"
                else
                    echo "? Ticket ???????? 'ticket:' ???"
                fi
            fi
        else
            echo "??? rustc???????..."
            echo "Ticket ??: ${#ticket}"
            if [[ $ticket == ticket:* ]]; then
                echo "? Ticket ?????? 'ticket:' ???"
            else
                echo "? Ticket ???????? 'ticket:' ???"
            fi
        fi
        ;;
    5)
        echo ""
        echo "???????..."
        echo "==================================="
        
        echo "?? Flutter..."
        cd app
        flutter clean
        flutter pub get
        
        echo ""
        echo "?? CLI..."
        cd ../cli
        cargo clean
        
        echo ""
        echo "? ????"
        echo ""
        echo "???? CLI..."
        cargo build
        
        echo ""
        echo "? ??????"
        ;;
    *)
        echo "?????"
        exit 1
        ;;
esac

echo ""
echo "==================================="
echo "??"
echo "==================================="
