use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Debug)]
struct FileEntry {
    path: String,
    size: u64,
    sha256: String,
    url: String,
    executable_flag: bool,
    permissions: String, // for now, empty or "755" etc.
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

fn compute_sha256_and_size(path: &Path) -> Result<(String, u64), Box<dyn std::error::Error>> {
    let data = fs::read(path)?;
    let size = data.len() as u64;
    let hash = Sha256::digest(&data);
    let sha256 = format!("{:x}", hash);
    Ok((sha256, size))
}

fn is_executable(path: &Path) -> bool {
    // Simple check: if no extension or exe, but for cross-platform, perhaps check file mode, but on Windows, use exe extension.
    path.extension().map_or(false, |ext| ext == "exe" || ext == "dll") // simplistic
}

fn generate_manifest(app_id: &str, channel: &str, version: &str, build_id: &str, build_new_path: &Path) -> Result<Manifest, Box<dyn std::error::Error>> {
    let mut files = Vec::new();
    for entry in WalkDir::new(build_new_path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();
            let rel_path = path.strip_prefix(build_new_path)?.to_string_lossy().replace('\\', "/"); // normalize to /
            let (sha256, size) = compute_sha256_and_size(path)?;
            let url = format!("/files/{}/{}/{}", version, sha256, rel_path);
            let executable_flag = is_executable(path);
            let permissions = if executable_flag { "755".to_string() } else { "644".to_string() };
            files.push(FileEntry {
                path: rel_path,
                size,
                sha256,
                url,
                executable_flag,
                permissions,
            });
        }
    }
    let created_at = Utc::now().to_rfc3339();
    Ok(Manifest {
        app_id: app_id.to_string(),
        channel: channel.to_string(),
        version: version.to_string(),
        build_id: build_id.to_string(),
        created_at,
        files,
        signature: None,
    })
}

fn output_root() -> PathBuf {
    let base = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../releases");
    base
}

fn copy_build_outputs(build_new_path: &Path, version: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let dest_dir = output_root().join("build_outputs").join(version);
    if dest_dir.exists() {
        fs::remove_dir_all(&dest_dir)?;
    }
    fs::create_dir_all(&dest_dir)?;

    for entry in WalkDir::new(build_new_path).into_iter().filter_map(|e| e.ok()) {
        let rel = entry.path().strip_prefix(build_new_path)?;
        let target_path = dest_dir.join(rel);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), &target_path)?;
        }
    }

    Ok(dest_dir)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 6 {
        eprintln!("Usage: {} <app_id> <channel> <version> <build_id> <build_new_path>", args[0]);
        std::process::exit(1);
    }
    let app_id = &args[1];
    let channel = &args[2];
    let version = &args[3];
    let build_id = &args[4];
    let build_new_path = Path::new(&args[5]);

    let manifest = generate_manifest(app_id, channel, version, build_id, build_new_path)?;
    let json = serde_json::to_string_pretty(&manifest)?;

    let output_base = output_root();
    fs::create_dir_all(&output_base)?;

    let copied_dir = copy_build_outputs(build_new_path, version)?;
    println!("Build outputs synced to {}", copied_dir.display());

    // Save manifest
    let manifests_dir = output_base.join("manifests");
    fs::create_dir_all(&manifests_dir)?;
    let manifest_path = manifests_dir.join(format!("{}.json", version));
    fs::write(&manifest_path, &json)?;
    println!("Manifest saved to {}", manifest_path.display());

    // Save channel pointer
    let channels_dir = output_base.join("channels");
    fs::create_dir_all(&channels_dir)?;
    let channel_path = channels_dir.join(format!("{}.json", channel));
    let channel_json = format!(r#"{{"latest_version": "{}"}}"#, version);
    fs::write(&channel_path, &channel_json)?;
    println!("Channel pointer saved to {}", channel_path.display());

    Ok(())
}
