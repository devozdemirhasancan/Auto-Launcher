# Security Considerations for CanartWorks Launcher

## Baseline Security
- **TLS Only**: All communications must use HTTPS. No HTTP allowed.
- **SHA256 Verification**: Every file download must be verified against its SHA256 hash before use.
- **Directory Traversal Protection**: All paths are sanitized and validated to prevent access outside intended directories.

## Client-Side Security
- **Integrity Checks**: Manifest and files are verified with cryptographic hashes.
- **Atomic Updates**: Updates are applied atomically to prevent partial/corrupted states.
- **Rollback Capability**: System can rollback to previous working version on failure.
- **No Arbitrary Code Execution**: Launcher does not execute downloaded code directly.

## Server-Side Security
- **Immutable Files**: Once published, manifest and files cannot be modified.
- **Path Sanitization**: File paths are validated to prevent directory traversal.
- **Access Control**: Admin endpoints (future) require authentication.
- **Rate Limiting**: Consider implementing rate limits to prevent abuse.

## Manifest Security
- **Schema Validation**: Manifests must conform to defined JSON schema.
- **Signature Verification** (Phase-3): Manifests signed with Ed25519, verified by client.
- **Version Immutability**: Published versions are immutable.

## Network Security
- **HTTPS Enforcement**: Server redirects HTTP to HTTPS.
- **Certificate Pinning** (Optional): Client can pin server certificates.
- **DNS Security**: Use DNSSEC if possible.

## Operational Security
- **Secure Uploads**: File uploads (future) require authentication.
- **Audit Logging**: All access and changes are logged.
- **Backup Security**: Backups are encrypted and access-controlled.

## Threat Mitigation
- **Tamper Detection**: SHA256 prevents undetected file modification.
- **Replay Attacks**: Version numbers and timestamps prevent replay.
- **Man-in-the-Middle**: TLS prevents MITM attacks.
- **DDoS Protection**: CDN can provide DDoS mitigation.

## Phase-3 Enhancements
- **Code Signing**: Sign executables with certificate.
- **Manifest Signing**: Ed25519 signatures for manifests.
- **Telemetry Privacy**: Anonymous usage statistics only.
- **Secure Boot**: Verify launcher integrity on startup.

## Security Audit
- Regularly audit the system for vulnerabilities.
- Keep dependencies updated.
- Monitor for security advisories in used libraries.
