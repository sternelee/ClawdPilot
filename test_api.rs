use iroh::{EndpointAddr, TransportAddr}; fn main() { let addr = EndpointAddr::new(iroh::PublicKey::from_bytes(&[0; 32]).unwrap()); println\!("Methods: {:?}", std::mem::size_of_val(&addr)); }
