# CanartWorks Launcher Protocol

## Overview
The CanartWorks Launcher uses a simple REST-like API for distributing patches and updates. All communication is over HTTPS.

## Endpoints

### GET /channels/{channel}.json
Returns the latest version information for a channel.

**Response:**
```json
{
  "latest_version": "1.0.0"
}
```

**Headers:**
- Cache-Control: no-cache

### GET /manifests/{version}.json
Returns the manifest for a specific version.

**Response:** See manifest.schema.json

**Headers:**
- Cache-Control: no-cache

### GET /files/{version}/{sha256}/{filename}
Serves the actual file content.

**Features:**
- Supports HTTP Range requests for resumable downloads
- Immutable URLs for aggressive caching

**Headers:**
- Cache-Control: public, max-age=31536000, immutable
- Accept-Ranges: bytes

## File URL Structure
Files are stored at `/files/{version}/{sha256}/{filename}` to ensure:
- Immutability: Same file always has same URL
- Cache efficiency: CDNs can cache indefinitely
- Integrity: SHA256 in URL for verification

## Client Flow
1. Fetch channel pointer
2. Fetch manifest for latest version
3. Compare with local installation
4. Download missing/changed files with resume support
5. Verify SHA256
6. Atomic apply update

## Error Handling
- 404: Resource not found
- 500: Server error
- Clients should retry with exponential backoff

## Versioning
- Semantic versioning (semver) for versions
- Build ID for unique identification
- Channels: stable, beta, dev
