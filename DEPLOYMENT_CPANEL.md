# DEPLOYMENT GUIDE: NEWSYT to TrueHost cPanel Node.js Hosting

## 🎯 Overview

This guide walks you through deploying the NEWSYT logistics system to **TrueHost cPanel Node.js shared hosting** (NOT a VPS). This environment has limitations:

- ✅ **Included**: Node.js, PostgreSQL, file storage, shared resources
- ❌ **NOT available**: Root access, Nginx, Redis, PM2, systemd, Docker
- ✅ **Frontend**: Served as static SPA files
- ✅ **Backend**: Express.js via Node.js App

---

## 📋 Prerequisites

### Before You Start:

1. **TrueHost cPanel Account**
   - Must have Node.js support (22.15.0+)
   - PostgreSQL database support
   - FTP or SSH access
   - Sufficient disk space (500MB+ recommended)

2. **Domain Setup**
   - Primary domain (e.g., `easybox.ke`)
   - Subdomains configured:
     - `admin.easybox.ke` (Frontend/Dashboard)
     - `api.easybox.ke` (Backend API)

3. **Local Machine**
   - Git installed
   - Node.js 18+ installed
   - Access to TrueHost SSH/FTP credentials

---

## 🚀 PHASE 1: Prepare Local Project

### Step 1: Clone and Setup Locally

```bash
git clone https://github.com/stevegithinjiwaweru-lang/NEWSYT.git
cd NEWSYT

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Step 2: Create Environment Files

**Backend:**

```bash
cp backend/.env.production.example backend/.env.production
```

Edit `backend/.env.production` with your values:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/easybox_db
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://admin.easybox.ke
JWT_SECRET=<generate-secure-value>
REFRESH_TOKEN_SECRET=<generate-secure-value>
UPLOADS_DIR=uploads
```

**To generate secure secrets:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Frontend:**

```bash
cp frontend/.env.production.example frontend/.env.production
```

Edit `frontend/.env.production`:

```env
VITE_API_URL=https://api.easybox.ke
VITE_SOCKET_URL=https://api.easybox.ke
```

### Step 3: Build Locally to Verify

```bash
# Backend
cd backend
npm run build
cd ..

# Frontend
cd frontend
npm run build
cd ..
```

Verify both builds complete without errors.

---

## 🌐 PHASE 2: Set Up TrueHost cPanel

### Step 4: Create PostgreSQL Database

1. **Login to TrueHost cPanel**
2. **Navigate to**: PostgreSQL Databases
3. **Create Database**:
   - Database name: `easybox_db`
   - Click "Create Database"

4. **Create PostgreSQL User**:
   - Username: `easybox_user`
   - Password: (generate and save securely)
   - Click "Create User"

5. **Add User to Database**:
   - Assign `easybox_user` to `easybox_db` with all privileges
   - Save your PostgreSQL connection details

**Test Connection** (optional):
```bash
psql -h localhost -U easybox_user -d easybox_db
# Type password when prompted
# Type \q to exit
```

### Step 5: Create Node.js Application in cPanel

1. **Login to TrueHost cPanel**
2. **Navigate to**: Setup Node.js App
3. **Create New Application**:
   - **Node.js Version**: 22.15.0 (or latest available)
   - **Application Mode**: Production
   - **Application Root**: `/home/username/public_html/newsyt-backend`
     - Replace `username` with your cPanel username
   - **Application Startup File**: `dist/index.js`
   - **Application URL**:
     - Add: `api.easybox.ke`
   - **PORT**: Assign available port (e.g., 4000, 5000)
     - cPanel will assign this automatically

4. **Save**. cPanel will generate:
   - Application URL
   - Assigned PORT (e.g., `3000`)
   - NPM Script

5. **Note the assigned PORT** - you'll need it

### Step 6: Create Static Site for Frontend

**Option A: Deploy to subdomain directory**

1. In cPanel, **Addon Domains**:
   - Add `admin.easybox.ke`
   - Document Root: `/home/username/public_html/admin.easybox.ke`

2. **Create `.htaccess` for SPA routing**:

Upload this to `/home/username/public_html/admin.easybox.ke/.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Option B: Use Node.js to serve frontend**

You can also serve the frontend from the same Node.js app. See **Phase 4** for details.

---

## 📤 PHASE 3: Upload Backend to TrueHost

### Step 7: Connect via SSH or FTP

**Using SSH (recommended):**

```bash
# SSH into cPanel server
ssh username@your-truehost-ip-or-domain
# Type your password when prompted
```

**Or using FTP:**
- Host: `ftp.your-domain.com`
- Username: your cPanel username
- Password: your cPanel password
- Use FileZilla or similar

### Step 8: Upload Backend Code

From your local machine:

```bash
# Navigate to backend
cd NEWSYT/backend

# Option 1: Use git (via SSH)
git clone https://github.com/stevegithinjiwaweru-lang/NEWSYT.git ~/newsyt-backend
cd ~/newsyt-backend/backend

# Option 2: Use FTP
# Upload the entire backend/ folder to:
# /home/username/public_html/newsyt-backend
```

### Step 9: Install Backend Dependencies on cPanel

**Via SSH:**

```bash
cd ~/public_html/newsyt-backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify build
ls -la dist/
```

This creates the `dist/` folder with compiled JavaScript.

### Step 10: Configure Environment Variables on cPanel

**Via SSH:**

```bash
cd ~/public_html/newsyt-backend

# Create .env file
nano .env
```

Paste your environment variables:

```env
DATABASE_URL=postgresql://easybox_user:your_password@localhost:5432/easybox_db
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://admin.easybox.ke
JWT_SECRET=<your-generated-secret>
REFRESH_TOKEN_SECRET=<your-generated-secret>
UPLOADS_DIR=uploads
LOG_LEVEL=info
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 11: Run Database Migrations

**Via SSH:**

```bash
cd ~/public_html/newsyt-backend

# Run migrations
npm run db:deploy

# Seed with sample data (optional)
npm run seed
```

If migrations fail, check:
- DATABASE_URL is correct
- PostgreSQL user can access the database
- Database exists

### Step 12: Start the Node.js Application

**In cPanel Setup Node.js App:**

1. Go back to cPanel > Setup Node.js App
2. Find your application (api.easybox.ke)
3. Click **Start** button
4. Wait 10-15 seconds for startup
5. Check status - should show **Running**

**Verify backend is running:**

```bash
curl https://api.easybox.ke/health

# Should return:
# {"ok":true,"service":"easybox-api","environment":"production",...}
```

---

## 🎨 PHASE 4: Deploy Frontend

### Step 13: Build Frontend

**Locally:**

```bash
cd frontend
npm run build

# Creates dist/ folder with static files
```

### Step 14: Upload Frontend Files

**Option A: Upload to addon domain directory**

```bash
# Via FTP/SSH
# Upload contents of frontend/dist/ to:
# /home/username/public_html/admin.easybox.ke/
```

**Option B: Serve from Node.js backend**

If you want one Node.js app for everything:

1. Copy frontend dist to backend:
   ```bash
   cp -r frontend/dist/* backend/public/
   ```

2. Add to backend `src/app.ts` after other routes:
   ```typescript
   // Serve static frontend files (SPA)
   app.use(express.static(path.join(__dirname, "../public")));
   
   // SPA routing: serve index.html for all non-API routes
   app.get("/*", (req, res) => {
     if (!req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
       res.sendFile(path.join(__dirname, "../public/index.html"));
     }
   });
   ```

3. Rebuild and restart Node.js app in cPanel

---

## ✅ PHASE 5: Verification & Testing

### Step 15: Test Backend API

```bash
# Health check
curl https://api.easybox.ke/health

# Login (create test admin first)
curl -X POST https://api.easybox.ke/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0700000000",
    "password": "secure-password-123",
    "name": "Admin",
    "role": "ADMIN"
  }'

# Get token
curl -X POST https://api.easybox.ke/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0700000000",
    "password": "secure-password-123"
  }'
```

### Step 16: Test Frontend Access

```bash
# Open in browser
https://admin.easybox.ke

# Should load dashboard, login page
# Try logging in with your test admin credentials
```

### Step 17: Test File Uploads

1. Go to **Orders** page in dashboard
2. Click **Upload CSV**
3. Select a merchant
4. Upload your CSV file
5. Verify orders are created

### Step 18: Monitor Logs

**Backend logs (via cPanel):**

1. cPanel > Setup Node.js App
2. Find your application
3. Click **Logs** button
4. View real-time logs for errors

**Or via SSH:**

```bash
cd ~/public_html/newsyt-backend

# View recent logs
tail -f logs/app.log 2>/dev/null || echo "Logs not available"
```

---

## 🔧 Common Issues & Troubleshooting

### Issue: "Cannot find module 'dist/index.js'"

**Solution:**
```bash
cd ~/public_html/newsyt-backend
npm run build
ls -la dist/  # Verify files exist
```

### Issue: "Database connection refused"

**Check PostgreSQL:**
```bash
psql -h localhost -U easybox_user -d easybox_db
# Enter password when prompted
# If this fails, ask TrueHost support to verify PostgreSQL is running
```

**Check DATABASE_URL:**
```bash
cd ~/public_html/newsyt-backend
cat .env | grep DATABASE_URL
```

### Issue: "Port already in use"

**Solution:**
- Change PORT in `.env` to different number (3000, 5000, 8000)
- Restart Node.js app in cPanel

### Issue: "CORS error in frontend"

**Check FRONTEND_URL:**
```bash
# Backend .env should have:
FRONTEND_URL=https://admin.easybox.ke

# Not localhost or incorrect domain
```

### Issue: "uploads directory permission denied"

**Solution:**
```bash
cd ~/public_html/newsyt-backend
chmod -R 755 uploads
chmod -R 755 logs
```

### Issue: "App keeps crashing"

**Check logs:**
1. cPanel > Setup Node.js App > Logs
2. Look for error messages
3. Common causes:
   - Missing environment variables
   - Database not reachable
   - Disk space full

---

## 📊 Monitoring & Maintenance

### Regular Tasks

**Check app status:**
```bash
curl https://api.easybox.ke/health
```

**View logs (via cPanel):**
- cPanel > Setup Node.js App > Logs
- Keep tab open to watch for issues

**Check disk usage:**
```bash
df -h ~/ | head -5
```

**Check database size:**
```bash
psql -h localhost -U easybox_user -d easybox_db -c "SELECT pg_size_pretty(pg_database_size('easybox_db'));"
```

### Backup Strategy

**Database backup:**
```bash
pg_dump -h localhost -U easybox_user easybox_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

**Download backups:**
- Via FTP: Download from `/home/username/public_html/newsyt-backend/uploads/`
- Via SSH: Use `scp` to download

---

## 🔄 Updating Your Application

### Pull Latest Code

```bash
cd ~/public_html/newsyt-backend

# Update code from git
git pull origin main

# Rebuild
npm install
npm run build

# Run any new migrations
npm run db:deploy
```

### Restart Application

1. cPanel > Setup Node.js App
2. Click **Stop**
3. Wait 5 seconds
4. Click **Start**

Or via SSH:

```bash
# Kill existing process
pkill -f "node dist/index.js" || true

# Start again (cPanel will auto-restart)
# Or manually:
cd ~/public_html/newsyt-backend
npm start
```

---

## 🎯 Production Checklist

- [ ] PostgreSQL database created
- [ ] PostgreSQL user created with strong password
- [ ] Node.js app created in cPanel
- [ ] Domain/subdomains configured
- [ ] Frontend domain (addon domain) configured
- [ ] Backend code uploaded and built
- [ ] Frontend code uploaded
- [ ] Environment variables (.env) created with real values
- [ ] Migrations run successfully
- [ ] Node.js app is running
- [ ] Backend API responds to `/health`
- [ ] Frontend loads at domain
- [ ] Login works
- [ ] CSV upload works
- [ ] CORS configured correctly
- [ ] Logs monitored for errors
- [ ] Backups scheduled or manually created

---

## 📞 Support

**For TrueHost Issues:**
- Contact TrueHost support
- Verify Node.js version: `node --version`
- Verify PostgreSQL is running
- Check cPanel logs

**For Application Issues:**
- Check cPanel Node.js app logs
- Check PostgreSQL connection
- Verify environment variables
- Review GitHub issues

---

## 🎉 You're Live!

Your NEWSYT application is now running on TrueHost cPanel:

- 🌐 **Dashboard**: https://admin.easybox.ke
- 🔌 **API**: https://api.easybox.ke
- 📊 **Health**: https://api.easybox.ke/health

Enjoy your logistics system! 🚀
