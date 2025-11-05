#!/usr/bin/env python3
import base64
import json
import sys

def parse_ticket(ticket):
    """解析 RiTerm 票据"""
    print(f"解析票据: {ticket[:50]}...")

    # 去掉 "ticket:" 前缀
    if ticket.startswith("ticket:"):
        encoded = ticket[7:]
    else:
        encoded = ticket

    print(f"Base32 编码部分: {encoded[:50]}...")

    # Base32 解码
    try:
        # Python 的 base64.b32decode 默认可能有问题，使用 casefold=True
        ticket_bytes = base64.b32decode(encoded, casefold=True)
        ticket_json = ticket_bytes.decode('utf-8')
        ticket_data = json.loads(ticket_json)

        print("\n📋 票据内容:")
        for key, value in ticket_data.items():
            if key == "endpoint_addr":
                print(f"{key}: {value[:50]}... (长度: {len(value)})")
            else:
                print(f"{key}: {value}")

        # 提取 endpoint_addr 并测试 base64 解码
        endpoint_addr_b64 = ticket_data.get("endpoint_addr", "")
        print(f"\n🔍 测试 endpoint_addr base64 解码:")
        print(f"原始字符串: {endpoint_addr_b64}")
        print(f"长度: {len(endpoint_addr_b64)}")

        # 检查是否包含无效字符
        valid_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
        invalid_chars = [c for c in endpoint_addr_b64 if c not in valid_chars]
        if invalid_chars:
            print(f"❌ 发现无效字符: {invalid_chars}")
        else:
            print("✅ 所有字符都有效")

        # 检查长度
        if len(endpoint_addr_b64) % 4 != 0:
            print(f"❌ 长度不是4的倍数: {len(endpoint_addr_b64)}")
        else:
            print("✅ 长度是4的倍数")

        # 尝试 base64 解码
        try:
            decoded_bytes = base64.b64decode(endpoint_addr_b64, validate=True)
            decoded_json = decoded_bytes.decode('utf-8')
            endpoint_data = json.loads(decoded_json)

            print(f"✅ Base64 解码成功!")
            print(f"解码后的 JSON: {json.dumps(endpoint_data, indent=2)}")

        except Exception as e:
            print(f"❌ Base64 解码失败: {e}")

            # 尝试清理空白字符
            cleaned = ''.join(endpoint_addr_b64.split())
            if cleaned != endpoint_addr_b64:
                print(f"📝 清理空白字符后: {cleaned}")
                print(f"清理后长度: {len(cleaned)}")

                if len(cleaned) % 4 != 0:
                    print(f"❌ 清理后长度仍不是4的倍数: {len(cleaned)}")
                else:
                    try:
                        decoded_bytes = base64.b64decode(cleaned, validate=True)
                        decoded_json = decoded_bytes.decode('utf-8')
                        endpoint_data = json.loads(decoded_json)
                        print(f"✅ 清理后 Base64 解码成功!")
                        print(f"解码后的 JSON: {json.dumps(endpoint_data, indent=2)}")
                    except Exception as e2:
                        print(f"❌ 清理后仍然解码失败: {e2}")

        return ticket_data

    except Exception as e:
        print(f"❌ 票据解析失败: {e}")
        return None

if __name__ == "__main__":
    ticket = "PMRGC3DQNYRDUITSNF2GK4TNL5YXK2LDEIWCEY3SMVQXIZLEL5QXIIR2GE3TMMRSGM2TGMBXFQRGK3TEOBXWS3TUL5QWIZDSEI5CEZLZJJ2WEMSSNRMDE3DLJFVG62KSK42WWY2HHFYGE3SSIJNEOUTZJFEHGZ3BK5ITMSKGIIYVS3LYOBMTA5DMMVJWQ22NGJLGQTLNJZUFS6SJGBMW2ULYLFLUSNKZPJDGUWSUM4YE42TLGJGVOWL2JZ5FM3CZGJCXOTKEJZWVS6TENJHDEVTNLFKGONKNGJNGWTLNKJVFU3KNGBMVOVJVJZCESMS2NJWGQS2TO5TVSV2SNNRW4TJWJFEHISTDINTXQTKDGQYE4QZUPFGUGNDYJ5CG6MKNKRATKTLZNQ4USSBQNFGEGSTZLJLXQ2DFKY4TCY3NO5UU63JVGFREO53TJFWVE4DDNVLGUZCGHFUFUR2SPFNFQTT2LJME22KPNR2GITCDJJUGESCCOVEWU33JLEZDS5CMNZFHAZCHKZ4WEUZVORNFQTT2LFLWI3DDPE4HQSLOGA6SELBCNZXWIZK7NFSCEORCKB2WE3DJMNFWK6JIMQZWKYJSMNQWGMRUMJSDCYLCHFRTCY3FHA2DMOJWGFTDGNZVMVRWCMBQGNTGGN3DG5SWMYJYHEZWMZBSMRRWMYZUMFSTSNBSGZTDSYJJEIWCE4TFNRQXSX3VOJWCEOTOOVWGY7="

    parse_ticket("ticket:" + ticket)