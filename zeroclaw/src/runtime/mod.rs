pub mod native;
pub mod traits;

#[cfg(any(feature = "tauri", feature = "desktop", feature = "mobile"))]
pub mod tauri_runtime;

pub use native::NativeRuntime;
pub use traits::RuntimeAdapter;

#[cfg(any(feature = "tauri", feature = "desktop", feature = "mobile"))]
pub use tauri_runtime::TauriRuntime;
