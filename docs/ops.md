# Operations Guide for CanartWorks Launcher Patch Platform

## Server Setup (Ubuntu Cloud)

### 1. Ubuntu Server Preparation
- Launch Ubuntu 20.04 LTS or later instance on your cloud provider (AWS, DigitalOcean, etc.)
- Update system: `sudo apt update && sudo apt upgrade`
- Install essential tools: `sudo apt install curl wget git ufw`

### 2. Nginx Installation and TLS
- Install Nginx: `sudo apt install nginx`
- Install Certbot for Let's Encrypt: `sudo apt install certbot python3-certbot-nginx`
- Configure firewall: `sudo ufw allow 'Nginx Full'`
- Obtain SSL certificate: `sudo certbot --nginx -d your-domain.com`
- Nginx will be configured for HTTPS automatically

### 3. Directory Structure
Create the web root directories:
```bash
sudo mkdir -p /var/www/patches/{channels,manifests,files}
sudo chown -R www-data:www-data /var/www/patches
sudo chmod -R 755 /var/www/patches
```

### 4. Nginx Configuration
- Copy `server/nginx/patches.conf` to `/etc/nginx/sites-available/patches`
- Edit the server_name to your actual domain
- Enable the site: `sudo ln -s /etc/nginx/sites-available/patches /etc/nginx/sites-enabled/`
- Remove default site: `sudo rm /etc/nginx/sites-enabled/default`
- Test config: `sudo nginx -t`
- Reload: `sudo systemctl reload nginx`

### 5. Smoke Test
- Place a test file: `echo "test" | sudo tee /var/www/patches/files/test.txt`
- Test download: `curl -I http://your-domain.com/files/test.txt`
- Test range requests: `curl -H "Range: bytes=0-3" http://your-domain.com/files/test.txt`
- Should return partial content

## Deployment Process

### Manual Deployment (MVP)
1. Run patcher locally: `cd tools/patcher && cargo run -- CanartWorks stable 1.0.0 build123 /path/to/build`
2. Rsync files to server:
   ```bash
   rsync -avz releases/manifests/ user@server:/var/www/patches/manifests/
   rsync -avz releases/channels/ user@server:/var/www/patches/channels/
   rsync -avz releases/build_outputs/1.0.0/ user@server:/var/www/patches/files/1.0.0/
   ```

### CI/CD Deployment (Future)
- Use GitHub Actions to build, run patcher, and deploy via rsync or S3

## Monitoring
- Nginx logs: `/var/log/nginx/patches_*.log`
- Monitor access patterns and errors
- Set up log rotation: `sudo logrotate /etc/logrotate.d/nginx`

## Backup
- Regularly backup `/var/www/patches/` directory
- Consider CDN integration for global distribution
