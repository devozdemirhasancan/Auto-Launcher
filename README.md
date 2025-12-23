# CanartWorks Launcher Platform

End-to-end launcher stack for distributing CanartWorks game updates with integrity guarantees, resumable downloads, and CI/CD automation.

---

## Contents
1. [Architecture](#architecture)
2. [Local Development](#local-development)
3. [Patch Publishing Workflow](#patch-publishing-workflow)
4. [Deployer CLI](#deployer-cli)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Server Setup](#server-setup)
7. [Security Checklist](#security-checklist)

---

## Architecture

| Layer | Description | Key Tech |
| --- | --- | --- |
| **Launcher UI** | Tauri + React desktop client with crash-safe update flow, manifest parsing, resumable downloads, logging | `launcher/` |
| **Patcher Tool** | Rust CLI that scans a build folder, computes SHA256, copies files into deterministic layout, emits manifest + channel pointer | `tools/patcher/` |
| **Deployer CLI** | Python CLI for Windows that runs patcher (optional), uploads outputs via SSH/SFTP, and can watch for local changes | `tools/deployer/` |
| **Patch Server** | Nginx-serving `/channels`, `/manifests`, `/files` with cache headers + range support; fronted by Cloudflare | `server/nginx/patches.conf` |
| **Docs** | Operational runbooks, protocol details, security notes | `docs/*.md` |

Key invariants:
- Files are addressed by `/files/<version>/<sha256>/<filename>` for immutability.
- Manifests include SHA256 + size per file.
- Channel pointer JSON advertises the latest semantic version.

---

## Local Development

```bash
# install deps once
cd launcher
npm install

# run Vite + Tauri shell
npm run tauri dev

# build production bundle (.exe + MSI)
npm run tauri build
```

React DevTools link: <https://reactjs.org/link/react-devtools>

---

## Patch Publishing Workflow

1. **Place build files** under `releases/build_outputs/<version>/`.
2. **Generate manifest + copy build**:
   ```bash
   cd tools/patcher
   cargo run -- CanartWorks stable 1.2.0 build456 ../../releases/build_outputs/1.2.0
   ```
   - Outputs:
     - `releases/manifests/1.2.0.json`
     - `releases/channels/stable.json`
     - `releases/build_outputs/1.2.0/...` (copied automatically)
3. **Upload** via the Deployer CLI or CI.

---

## Deployer CLI

Located at `tools/deployer/`.

### Setup
```bash
cd tools/deployer
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy config.example.json config.json   # fill host/user/paths
```

### Commands

Run patcher + upload:
```bash
python deployer.py deploy --version 1.2.0 --build-id build456
```

Just re-upload without regenerating:
```bash
python deployer.py deploy --version 1.2.0 --build-id build456 --skip-patcher
```

Watch local folders and auto-sync:
```bash
python deployer.py watch --version 1.2.0
```

Uses Paramiko (SSH/SFTP) and Watchdog for file monitoring.

---

## CI/CD Pipeline

Workflow: `.github/workflows/deploy.yml`

Features:
- Triggered on `push` to `main` or manually (`workflow_dispatch`).
- Inputs: `version`, `build_id` (with defaults).
- Steps:
  1. Checkout + install Rust
  2. Build `tools/patcher` once
  3. Run patcher with `../releases/build_outputs/<version>`
  4. Upload manifests/channels/files via `scp` (replace with rsync/action if desired)
  5. Placeholder for URL validation

Secrets to configure:
- SSH private key or password for `root@patcher host`.
- Optional: use `appleboy/scp-action` or similar to avoid inline passwords.

---

## Server Setup

Summarized (see `docs/ops.md` for full instructions):

1. **Ubuntu Prep** – install updates, `nginx`, `certbot`, `ufw`.
2. **Directories** – `sudo mkdir -p /var/www/patcher/{channels,manifests,files}`.
3. **Nginx config** – use `server/nginx/patches.conf` (or variant for `patcher.<domain>`). Key points:
   - Cloudflare real IP headers.
   - `/channels` & `/manifests`: `Cache-Control: no-cache`.
   - `/files`: `Cache-Control: public, max-age=31536000, immutable` + range support.
4. **TLS** – Certbot per subdomain (`patcher.domain.com`).
5. **Smoke tests** – `curl -I https://patcher.../manifests/1.2.0.json` etc.

---

## Security Checklist

From `docs/security.md` (highlights):
- HTTPS only + Cloudflare proxy.
- SHA256 verification enforced by launcher.
- Atomic apply + rollback plan.
- Manifest schema validation; future Ed25519 signatures.
- Server hardening: immutable files, path sanitization, rate limiting.
- Operational alerts for failed downloads / errors.

---

## Roadmap
- Manifest signing (Ed25519) + verification in launcher.
- CI uploading via GitHub Actions secrets with automatic smoke tests.
- CDN caching for `/files`.
- Telemetry opt-in to track update success/failure.

---

## Contributors Guide

1. Fork & clone.
2. Ensure `rustup`, `node 18+`, `python 3.11+` installed.
3. Run `npm run tauri dev` for frontend work, `cargo test` (future) for Rust components.
4. Keep `.gitignore` entries for generated artifacts (`/releases/...`).

Please open issues/PRs for:
- Launcher UX improvements
- Patch protocol changes
- Deployment automation

---

Happy shipping! 🚀
