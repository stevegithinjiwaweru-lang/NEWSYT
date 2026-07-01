#!/bin/bash
set -e

echo "🚀 Easybox Deployment Setup"
echo "================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ This script must be run as root"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt update
apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Install Nginx
echo "🌐 Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL
echo "🔒 Installing Certbot for SSL..."
apt install -y certbot python3-certbot-nginx

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p /app/easybox/{backend,frontend}
mkdir -p /var/www/easybox-frontend/dist
mkdir -p /app/uploads /app/logs

# Set permissions
chmod 755 /app/easybox
chmod 755 /var/www/easybox-frontend

echo ""
echo "✅ Prerequisites installed!"
echo ""
echo "📝 Next steps:"
echo "1. Clone repository:"
echo "   cd /app/easybox/backend"
echo "   git clone <repo-url> ."
echo ""
echo "2. Setup SSL certificates:"
echo "   certbot certonly --standalone -d api.easybox.ke"
echo "   certbot certonly --standalone -d admin.easybox.ke"
echo ""
echo "3. Configure environment variables:"
echo "   cp .env.production .env"
echo "   nano .env  # Edit with your secrets"
echo ""
echo "4. Deploy backend:"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "5. Build and deploy frontend:"
echo "   cd /app/easybox/frontend"
echo "   npm install && npm run build"
echo "   cp -r dist/* /var/www/easybox-frontend/dist/"
echo ""
echo "6. Setup Nginx:"
echo "   cp nginx.conf /etc/nginx/sites-available/backend"
echo "   cp frontend/nginx.conf /etc/nginx/sites-available/frontend"
echo "   ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/"
echo "   ln -s /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl restart nginx"
echo ""
echo "7. Enable auto-renewal of SSL certificates:"
echo "   certbot renew --dry-run"
echo ""
