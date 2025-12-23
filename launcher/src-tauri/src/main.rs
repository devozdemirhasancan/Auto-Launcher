#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use tauri::{command, Window};
use tokio::time::{sleep, Duration};

#[derive(Serialize, Deserialize, Debug)]
struct FileEntry {
    path: String,
    size: u64,
    sha256: String,
    url: String,
    executable_flag: bool,
    permissions: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct Manifest {
    app_id: String,
    channel: String,
    version: String,
    build_id: String,
    created_at: String,
    files: Vec<FileEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    signature: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChannelPointer {
    latest_version: String,
}

#[command]
async fn start_update(window: Window) -> Result<(), String> {
    // Simulate the update process
    window.emit("status", "Starting update...").unwrap();
    sleep(Duration::from_secs(1)).await;

    window.emit("status", "Fetching channel pointer...").unwrap();
    // Simulate fetch channel
    let channel_data = r#"{"latest_version": "1.0.0"}"#;
    let channel: ChannelPointer = serde_json::from_str(channel_data).map_err(|e| e.to_string())?;
    sleep(Duration::from_secs(1)).await;

    window.emit("status", &format!("Latest version: {}", channel.latest_version)).unwrap();
    sleep(Duration::from_secs(1)).await;

    window.emit("status", "Fetching manifest...").unwrap();
    // Simulate fetch manifest
    let manifest_data = r#"{
        "app_id": "CanartWorks",
        "channel": "stable",
        "version": "1.0.0",
        "build_id": "build123",
        "created_at": "2025-12-23T01:36:21.931832600+00:00",
        "files": [
            {
                "path": "game.exe",
                "size": 38,
                "sha256": "b56c7bdfc6f1d99ff609b357a9a33ace1f0d154271497b33e1ab00312a699775",
                "url": "/files/1.0.0/b56c7bdfc6f1d99ff609b357a9a33ace1f0d154271497b33e1ab00312a699775/game.exe",
                "executable_flag": true,
                "permissions": "755"
            }
        ]
    }"#;
    let manifest: Manifest = serde_json::from_str(manifest_data).map_err(|e| e.to_string())?;
    sleep(Duration::from_secs(1)).await;

    window.emit("status", "Scanning local installation...").unwrap();
    // Simulate scan
    sleep(Duration::from_secs(1)).await;

    window.emit("status", "Planning download...").unwrap();
    // Simulate plan
    let files_to_download = manifest.files.len();
    sleep(Duration::from_secs(1)).await;

    window.emit("status", "Downloading files...").unwrap();
    for (i, file) in manifest.files.iter().enumerate() {
        window.emit("status", &format!("Downloading {}...", file.path)).unwrap();
        window.emit("progress", (i as f32 / files_to_download as f32 * 50.0) as f32).unwrap();
        sleep(Duration::from_secs(2)).await;
    }

    window.emit("status", "Verifying files...").unwrap();
    window.emit("progress", 75.0).unwrap();
    sleep(Duration::from_secs(1)).await;

    window.emit("status", "Applying update...").unwrap();
    window.emit("progress", 90.0).unwrap();
    sleep(Duration::from_secs(1)).await;

    window.emit("status", "Update complete!").unwrap();
    window.emit("progress", 100.0).unwrap();

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
