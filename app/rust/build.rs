fn main() {
    // Link SystemConfiguration framework on macOS
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=framework=SystemConfiguration");
        println!("cargo:rustc-link-lib=framework=CoreFoundation");
        println!("cargo:rustc-link-lib=framework=Security");
    }

    // Link SystemConfiguration framework on iOS
    #[cfg(target_os = "ios")]
    {
        println!("cargo:rustc-link-lib=framework=SystemConfiguration");
        println!("cargo:rustc-link-lib=framework=CoreFoundation");
        println!("cargo:rustc-link-lib=framework=Security");
    }
}