# NEWSYT Backend - Production Deployment Guide

## Pre-Deployment Checklist

### ✅ Backend Setup

1. **Environment Variables**
   ```bash
   # Copy and configure production environment
   cp backend/.env.production backend/.env
   
   # Edit and set actual values:
   # - DATABASE_URL: PostgreSQL connection string
   # - PORT: Server port (default 4000)
   # - NODE_ENV: MUST be "production"
   # - UPLOADS_DIR: Path for file uploads
   # - JWT secrets (strong, random values)
   ```

2. **Build Verification**
   ```bash
   cd backend
   npm install
   npm run verify:build
   ```
   This runs:
   - TypeScript compilation (`tsc`)
   - Prisma Client generation
   - Node syntax check on dist/index.js

3. **Database Migration**
   ```bash
   # Ensure DATABASE_URL is set
   npm run db:deploy
   ```

4. **Database Seeding (Development Only)**
   ```bash
   # This will NOT create fake orders in production (NODE_ENV=production)
   npm run seed:prod
   ```

### ✅ Running Production Server

**Locally (without Docker):**
```bash
npm run start:prod
```

**With Docker:**
```bash
# Build image
docker build -f backend/Dockerfile -t easybox-backend:latest .

# Run container
docker run -d \
  --name easybox-backend \
  --restart unless-stopped \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://user:pass@db-host:5432/easybox" \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -v easybox-uploads:/app/uploads \
  easybox-backend:latest
```

### ✅ Health Check

```bash
curl http://localhost:4000/health
# Expected response:
# {"ok":true,"service":"easybox-api","timestamp":"2026-06-30T..."}
```

## Troubleshooting

### "dist/index.js not found"
```bash
npm run build
```

### "Prisma client not found"
```bash
npm run prisma:generate
```

### "Database connection failed"
- Verify DATABASE_URL format
- Ensure database is accessible
- Check firewall/network rules
- Verify credentials

### "Missing environment variables"
Check that all required vars are set:
- `DATABASE_URL` ✓
- `NODE_ENV=production` ✓
- `PORT` ✓

### Fake orders still appearing
Ensure `NODE_ENV=production` is set:
```bash
echo $NODE_ENV  # Should output "production"
```

## Performance Tips

1. **Connection Pooling**
   - Use PgBouncer for PostgreSQL
   - Redis for job queue stability

2. **File Uploads**
   - Use mounted volume or S3/cloud storage
   - Ensure sufficient disk space

3. **Logging**
   - Set `LOG_LEVEL=info` in production
   - Use centralized logging (e.g., ELK, Datadog)

## Security Checklist

- [ ] Strong JWT_SECRET generated
- [ ] DATABASE_URL uses non-root user
- [ ] CORS origin properly configured
- [ ] NODE_ENV=production enforced
- [ ] Uploads directory writable but not served as downloads
- [ ] No .env file in version control
- [ ] No console.log sensitive data

## Deployment to Cloud Platforms

### **Railway, Render, or Similar**
```bash
# Set environment variables in platform dashboard:
NODE_ENV=production
DATABASE_URL=<your-db-connection>
PORT=<platform-assigned-port>

# Deploy:
git push origin main
# Platform auto-builds and runs: npm run start:prod
```

### **AWS ECS/Fargate**
1. Build and push Docker image to ECR
2. Create task definition with above environment variables
3. Run task with exposed port 4000
4. Attach RDS PostgreSQL database

### **Heroku** (Legacy)
```bash
heroku buildpacks:add heroku/nodejs
heroku config:set NODE_ENV=production DATABASE_URL=<postgresql-uri>
git push heroku main
```

## Monitoring

Setup alerts for:
- Server down (health check failed)
- High response times
- Database connection errors
- Disk space (for uploads)
- Memory usage

## Rolling Back

If deployment fails:
```bash
# Revert to previous version
git revert HEAD
npm run build
npm run db:migrate  # If needed
npm run start:prod
```

---

**Last Updated:** 2026-06-30  
**Version:** 0.1.0
