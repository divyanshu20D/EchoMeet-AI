# 🚀 VideoMeet Complete Setup Guide

## Step-by-Step Setup Instructions

### 1. Prerequisites Check

Make sure you have these installed:

```bash
# Check Node.js version (should be 16+)
node --version

# Check npm version (should be 8+)
npm --version

# Check if PostgreSQL is installed and running
psql --version

# Check if Redis is installed and running
redis-cli ping
```

### 2. Quick Setup (Recommended)

```bash
# 1. Install all dependencies
npm run setup

# 2. Set up environment files
cp server/.env.example server/.env
cp Google-meet/.env.example Google-meet/.env

# 3. Edit server/.env with your database credentials
# DATABASE_URL="postgresql://username:password@localhost:5432/videomeet"

# 4. Run database setup
cd server
npm run db:migrate
cd ..

# 5. Start both servers
npm run dev
```

### 3. Manual Setup (If Quick Setup Fails)

#### Backend Setup:
```bash
cd server

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env file with your database and Redis settings

# Set up database
npm run db:generate
npm run db:migrate

# Test the setup
npm run test:redis
npm run test:api

# Start backend server
npm run dev
```

#### Frontend Setup:
```bash
cd Google-meet

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Make sure REACT_APP_API_URL=http://localhost:3001

# Start frontend server
npm start
```

### 4. Fix Common Import/Export Errors

If you get import/export errors in the backend, run this fix:

```bash
# Convert CommonJS to ES6 modules
node fix-imports.js

# Or manually ensure server/package.json has:
# "type": "module"
```

### 5. Database Configuration

Create a PostgreSQL database:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE videomeet;

-- Create user (optional)
CREATE USER videomeet_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE videomeet TO videomeet_user;
```

Update your `server/.env`:
```env
DATABASE_URL="postgresql://videomeet_user:your_password@localhost:5432/videomeet"
```

### 6. Redis Configuration

Start Redis server:
```bash
# On macOS with Homebrew
brew services start redis

# On Ubuntu/Debian
sudo systemctl start redis-server

# On Windows (if using WSL)
sudo service redis-server start

# Test Redis connection
redis-cli ping
# Should return: PONG
```

### 7. Environment Variables

#### Backend (.env in server folder):
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/videomeet"

# JWT Secrets (generate strong secrets)
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-minimum-32-characters"

# Server Configuration
PORT=3001
FRONTEND_URL="http://localhost:3000"

# Redis Configuration
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
REDIS_DB=0
REDIS_KEY_PREFIX="video_conf:"

# Optional: Email Configuration (for MFA)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

#### Frontend (.env in Google-meet folder):
```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001

# WebRTC Configuration
REACT_APP_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# Feature Flags
REACT_APP_ENABLE_SCREEN_SHARE=true
REACT_APP_ENABLE_RECORDING=true
REACT_APP_MAX_PARTICIPANTS=100
```

### 8. Testing the Setup

1. **Backend Health Check:**
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"OK","timestamp":"..."}
   ```

2. **Frontend Access:**
   - Open http://localhost:3000
   - You should see the login page

3. **Create Test Account:**
   - Click "Sign up here"
   - Fill in the registration form
   - Login with your credentials

4. **Test Meeting Creation:**
   - Click "New Meeting"
   - Fill in meeting details
   - Create and join the meeting

### 9. Troubleshooting Common Issues

#### Issue: "Cannot use import statement outside a module"
**Solution:**
```bash
# Make sure server/package.json has:
"type": "module"

# And all imports use .js extensions:
import something from './file.js';
```

#### Issue: Database connection failed
**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
psql -U postgres -l | grep videomeet

# Test connection
psql "postgresql://username:password@localhost:5432/videomeet"
```

#### Issue: Redis connection failed
**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
redis-server

# Check Redis configuration
redis-cli config get "*"
```

#### Issue: Port already in use
**Solution:**
```bash
# Kill process on port 3001
npx kill-port 3001

# Or change port in server/.env
PORT=3002
```

#### Issue: Frontend build errors
**Solution:**
```bash
cd Google-meet
rm -rf node_modules package-lock.json
npm install
```

### 10. Development Workflow

#### Starting Development:
```bash
# Start both servers
npm run dev

# Or start separately:
npm run start:backend    # Terminal 1
npm run start:frontend   # Terminal 2
```

#### Making Changes:
- Backend changes auto-reload with nodemon
- Frontend changes auto-reload with React dev server
- Database changes require migration: `npm run db:migrate`

#### Testing:
```bash
# Test backend API
cd server && npm run test:api

# Test frontend
cd Google-meet && npm test
```

### 11. Production Build

```bash
# Build frontend for production
cd Google-meet
npm run build

# The build folder contains the production-ready files
# Serve with any static file server
```

### 12. Next Steps

Once everything is running:

1. **Explore Features:**
   - User registration and login
   - Meeting creation and management
   - Video calling with WebRTC
   - Real-time chat
   - Screen sharing
   - Multi-factor authentication

2. **Customize:**
   - Update branding and colors
   - Configure TURN servers for production
   - Set up email notifications
   - Add custom meeting features

3. **Deploy:**
   - Set up production database
   - Configure reverse proxy (nginx)
   - Set up SSL certificates
   - Deploy to cloud platform

## 🎉 Success!

If you can access http://localhost:3000 and create/join meetings, congratulations! Your VideoMeet platform is ready for development.

For support, check the console logs and ensure all services are running correctly.