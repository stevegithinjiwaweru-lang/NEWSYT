# NEWSYT - Production Deployment Guide

## Domain Setup

Your application will be accessible at:
- **Backend API:** https://api.easybox.ke
- **Frontend Dashboard:** https://admin.easybox.ke

## Prerequisites

- VPS/Server with Ubuntu 20.04+ or similar Linux
- Domain with DNS pointing to your server
- SSH access to your server
- 2GB RAM minimum, 10GB storage minimum

## Deployment Steps

### 1. Initial Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Run setup script
cd /tmp
wget https://raw.githubusercontent.com/your-repo/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

This installs:
- Docker & Docker Compose
- Nginx
- Certbot (SSL certificates)

### 2. Clone Repository

```bash
cd /app/easybox
git clone https://github.com/stevegithinjiwaweru-lang/NEWSYT.git backend
cd backend
```

### 3. Setup SSL Certificates

```bash
# For backend subdomain
certbot certonly --standalone -d api.easybox.ke

# For frontend subdomain
certbot certonly --standalone -d admin.easybox.ke

# Auto-renewal (runs automatically via systemd)
systemctl enable certbot.timer
```

### 4. Configure Backend Environment

```bash
# Backend setup
cp .env.production .env

# Edit with your secrets
nano .env
```

**Critical variables to change:**
```env
DATABASE_URL=postgresql://user:strong-password@db:5432/easybox_prod
JWT_SECRET=generate-strong-random-string
REFRESH_TOKEN_SECRET=generate-another-strong-string
EASYBOX_API_KEY=your-actual-easybox-api-key
EASYBOX_WEBHOOK_SECRET=your-actual-webhook-secret-min-32-chars
POSTGRES_PASSWORD=change-this-password
```

To generate strong secrets:
```bash
# In your terminal
openssl rand -base64 32
```

### 5. Deploy Backend with Docker

```bash
cd /app/easybox/backend

# Build and start containers
docker-compose -f docker-compose.prod.yml up -d

# Verify containers are running
docker ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker-compose -f docker-compose.prod.yml exec backend npm run seed
```

### 6. Setup Frontend

```bash
# Clone frontend repo or copy files
cd /app/easybox

# Setup production environment
cp frontend/.env.production frontend/.env

# Build
cd frontend
npm install
npm run build

# Copy to Nginx
sudo cp -r dist/* /var/www/easybox-frontend/dist/
sudo chown -R www-data:www-data /var/www/easybox-frontend
```

### 7. Configure Nginx

```bash
# Copy Nginx configs
sudo cp /app/easybox/backend/nginx.conf /etc/nginx/sites-available/api-backend
sudo cp /app/easybox/frontend/nginx.conf /etc/nginx/sites-available/admin-frontend

# Enable sites
sudo ln -s /etc/nginx/sites-available/api-backend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin-frontend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 8. Verify Deployment

```bash
# Test backend health
curl https://api.easybox.ke/health

# Test frontend
curl -I https://admin.easybox.ke

# Check SSL certificate
curl -vI https://api.easybox.ke

# View backend logs
docker-compose -f docker-compose.prod.yml logs backend -f

# View database logs
docker-compose -f docker-compose.prod.yml logs db -f
```

## Post-Deployment Configuration

### Create Merchants

```bash
# Access backend container
docker-compose -f docker-compose.prod.yml exec backend sh

# You can also do this via API:
curl -X POST https://api.easybox.ke/merchants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Carrefour",
    "connector": "CSV"
  }'
```

### Configure Easybox Webhook

In your Easybox dashboard, set webhook URL to:
```
https://api.easybox.ke/webhooks/easybox
```

Webhook secret must match `EASYBOX_WEBHOOK_SECRET` in your `.env`

### Setup Backup Strategy

```bash
# Daily database backup
cat > /etc/cron.daily/easybox-backup << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/app/backups
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f /app/easybox/backend/docker-compose.prod.yml \
  exec -T db pg_dump -U easybox_user easybox_prod | \
  gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/easybox-backup
```

## Monitoring & Maintenance

### Monitor Docker Containers

```bash
# Real-time stats
docker stats

# View logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Restart service
docker-compose -f docker-compose.prod.yml restart backend
```

### Update Application

```bash
# Pull latest code
cd /app/easybox/backend
git pull origin main

# Rebuild and redeploy
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations if needed
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### SSL Certificate Renewal

Certbot auto-renewal runs via systemd, but you can manually renew:

```bash
certbot renew --dry-run  # Test
certbot renew            # Actually renew
```

## Troubleshooting

### Backend not responding

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs backend

# Restart
docker-compose -f docker-compose.prod.yml restart backend
```

### Database connection issues

```bash
# Check database container
docker-compose -f docker-compose.prod.yml logs db

# Verify environment variables
docker-compose -f docker-compose.prod.yml config | grep DATABASE_URL
```

### Frontend shows blank page

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify frontend files exist
ls -la /var/www/easybox-frontend/dist/

# Check Nginx configuration
sudo nginx -t
```

### SSL Certificate issues

```bash
# Check certificate status
sudo certbot certificates

# Debug renewal
sudo certbot renew --dry-run -v

# View Nginx SSL errors
sudo tail -f /var/log/nginx/error.log | grep ssl
```

## Performance Optimization

### Enable Gzip compression in Nginx

Add to server block:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

### Database indexing

```bash
docker-compose -f docker-compose.prod.yml exec backend \
  npx prisma db execute < optimize.sql
```

### Redis caching

Already configured in Docker Compose. Verify:

```bash
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT secrets
- [ ] Configure firewall rules
- [ ] Enable automatic backups
- [ ] Setup log monitoring
- [ ] Configure rate limiting in Nginx
- [ ] Use strong database credentials
- [ ] Restrict file permissions
- [ ] Enable HTTPS everywhere
- [ ] Setup DDoS protection (Cloudflare)

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Review error messages in Nginx: `/var/log/nginx/error.log`
3. Check database connection: `docker-compose -f docker-compose.prod.yml exec db psql -U easybox_user`

---

**Deployment complete! Your application is now live at:**
- 🌐 https://admin.easybox.ke (Dashboard)
- 🔌 https://api.easybox.ke (API)
