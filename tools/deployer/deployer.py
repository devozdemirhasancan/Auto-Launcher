import argparse
import json
import os
import posixpath
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import paramiko
from colorama import Fore, Style, init as colorama_init
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


colorama_init(autoreset=True)


class ConfigError(ValueError):
    pass


def log(message: str, level: str = "info") -> None:
    colors = {
        "info": Fore.CYAN,
        "ok": Fore.GREEN,
        "warn": Fore.YELLOW,
        "error": Fore.RED,
    }
    print(f"{colors.get(level, Fore.WHITE)}[{level.upper()}]{Style.RESET_ALL} {message}")


def load_config(path: Path) -> dict:
    if not path.exists():
        raise ConfigError(f"Config file not found: {path}")
    with path.open("r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    required_keys = [
        "host",
        "username",
        "remote_root",
        "channel",
        "app_id",
        "build_outputs_dir",
        "manifests_dir",
        "channels_dir",
        "patcher_dir",
    ]
    missing = [key for key in required_keys if not cfg.get(key)]
    if missing:
        raise ConfigError(f"Missing config keys: {', '.join(missing)}")
    return cfg


def connect_ssh(cfg: dict) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key_path = cfg.get("key_path")
    password = cfg.get("password")
    try:
        if key_path:
            key = paramiko.RSAKey.from_private_key_file(os.path.expanduser(key_path))
            client.connect(
                cfg["host"], username=cfg["username"], pkey=key, look_for_keys=False, timeout=10
            )
        else:
            client.connect(
                cfg["host"],
                username=cfg["username"],
                password=password,
                look_for_keys=False,
                timeout=10,
            )
    except Exception as exc:
        raise ConnectionError(f"SSH connection failed: {exc}") from exc
    return client


def run_patcher(cfg: dict, version: str, build_id: str) -> None:
    patcher_dir = Path(cfg["patcher_dir"]).resolve()
    build_out = Path(cfg["build_outputs_dir"]).resolve() / version
    if not build_out.exists():
        raise ConfigError(f"Build outputs not found for version {version}: {build_out}")
    cmd = [
        "cargo",
        "run",
        "--release",
        "--",
        cfg["app_id"],
        cfg["channel"],
        version,
        build_id,
        str(build_out),
    ]
    log(f"Running patcher: {' '.join(cmd)}", "info")
    subprocess.run(cmd, cwd=patcher_dir, check=True)


def remote_join(*parts: str) -> str:
    return posixpath.join(*parts)


def ensure_remote_dir(ssh: paramiko.SSHClient, remote_path: str) -> None:
    ssh.exec_command(f"mkdir -p {remote_path}")


def sync_path(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    if local.is_dir():
        ensure_remote_dir(sftp.get_channel().get_transport().getpeername(), remote)
    if local.is_dir():
        ensure_remote_dir(sftp, remote)
        for item in local.iterdir():
            sync_path(sftp, item, remote_join(remote, item.name.replace("\\", "/")))
    else:
        parent = posixpath.dirname(remote)
        if parent:
            try:
                sftp.stat(parent)
            except IOError:
                ensure_remote_dir(sftp, parent)
        log(f"Uploading {local} -> {remote}", "info")
        sftp.put(str(local), remote)


def deploy(cfg: dict, version: str, build_id: str, run_patch: bool) -> None:
    if run_patch:
        run_patcher(cfg, version, build_id)

    manifests_dir = Path(cfg["manifests_dir"]).resolve()
    channels_dir = Path(cfg["channels_dir"]).resolve()
    files_dir = Path(cfg["build_outputs_dir"]).resolve() / version
    remote_root = cfg["remote_root"].rstrip("/")

    ssh = connect_ssh(cfg)
    sftp = ssh.open_sftp()
    try:
        ensure_remote_dir(ssh, remote_join(remote_root, "manifests"))
        ensure_remote_dir(ssh, remote_join(remote_root, "channels"))
        ensure_remote_dir(ssh, remote_join(remote_root, "files", version))

        sync_path(sftp, manifests_dir, remote_join(remote_root, "manifests"))
        sync_path(sftp, channels_dir, remote_join(remote_root, "channels"))
        sync_path(sftp, files_dir, remote_join(remote_root, "files", version))
        log("Deployment finished", "ok")
    finally:
        sftp.close()
        ssh.close()


class ChangeHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_any_event(self, event):
        if not event.is_directory:
            self.callback(event.src_path)


def watch(cfg: dict, version: str) -> None:
    manifests_dir = Path(cfg["manifests_dir"]).resolve()
    channels_dir = Path(cfg["channels_dir"]).resolve()
    files_dir = Path(cfg["build_outputs_dir"]).resolve() / version

    def handle_change(path):
        log(f"Change detected: {path}", "warn")
        try:
            deploy(cfg, version, cfg.get("default_build_id", "build000"), run_patch=False)
        except Exception as exc:
            log(f"Auto-sync failed: {exc}", "error")

    observer = Observer()
    handler = ChangeHandler(handle_change)
    for path in (manifests_dir, channels_dir, files_dir):
        observer.schedule(handler, str(path), recursive=True)
        log(f"Watching {path}", "info")
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Stopping watcher...", "warn")
        observer.stop()
    observer.join()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CanartWorks patch deployer CLI")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).resolve().parent / "config.json",
        help="Path to deployer config JSON",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    deploy_cmd = sub.add_parser("deploy", help="Generate patch and upload to server")
    deploy_cmd.add_argument("--version", required=True, help="Version string (semver)")
    deploy_cmd.add_argument("--build-id", required=True, help="Build identifier")
    deploy_cmd.add_argument(
        "--skip-patcher", action="store_true", help="Skip running the patcher locally"
    )

    watch_cmd = sub.add_parser("watch", help="Watch local folders and auto-upload")
    watch_cmd.add_argument("--version", required=True, help="Version to monitor")

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        cfg = load_config(args.config)
    except ConfigError as exc:
        log(str(exc), "error")
        sys.exit(1)

    try:
        if args.command == "deploy":
            deploy(
                cfg,
                args.version,
                args.build_id,
                run_patch=not args.skip_patcher,
            )
        elif args.command == "watch":
            watch(cfg, args.version)
    except subprocess.CalledProcessError as exc:
        log(f"Patcher failed: {exc}", "error")
        sys.exit(exc.returncode)
    except Exception as exc:
        log(f"Error: {exc}", "error")
        sys.exit(1)


if __name__ == "__main__":
    main()
