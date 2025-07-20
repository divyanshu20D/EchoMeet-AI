# Video Conferencing Server

A production-ready video conferencing server built with Node.js, Express, Socket.IO, PostgreSQL, and Prisma.

## Features

- 🔐 JWT-based authentication with refresh tokens
- 🗄️ PostgreSQL database with Prisma ORM
- ✅ Zod validation for all API endpoints
- 🛡️ Security middleware (Helmet, CORS, Rate limiting)
- 🏠 Meeting management (create, join, manage)
- 💬 Real-time chat and WebRTC signaling
- 📊 User and organization management
- 🔍 Comprehensive error handling
- 📝 Audit logging

## Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## Quick Start

1. **Clone and navigate to server directory**
   ```bash
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run setup script**
   ```bash
   node setup.js
   ```

4. **Update environment variables**
   Edit `.env` file with your database credentials:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/video_conferencing_db"
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/me` - Get current user profile

### Meetings
- `POST /api/meetings` - Create new meeting
- `GET /api/meetings` - Get user's meetings
- `GET /api/meetings/:id` - Get meeting details
- `PUT /api/meetings/:id` - Update meeting
- `DELETE /api/meetings/:id` - Delete meeting
- `POST /api/meetings/:id/start` - Start meeting
- `POST /api/meetings/:id/end` - End meeting

### System
- `GET /health` - Health check
- `GET /api` - API information

## Database Schema

The application uses the following main entities:

- **Users** - User accounts and profiles
- **Organizations** - Multi-tenant organization support
- **Meetings** - Meeting metadata and settings
- **Participants** - Meeting participation records
- **Recordings** - Meeting recordings metadata
- **ChatMessages** - Chat message history
- **UserSessions** - Active user sessions
- **AuditLogs** - System audit trail

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | Required |
| `JWT_EXPIRES_IN` | Access token expiration | 15m |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | 7d |
| `PORT` | Server port | 4000 |
| `NODE_ENV` | Environment | development |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## Security Features

- Password hashing with bcrypt
- JWT tokens with refresh token rotation
- Rate limiting
- CORS protection
- Security headers with Helmet
- Input validation with Zod
- SQL injection prevention with Prisma

## WebSocket Events

The server handles the following Socket.IO events:

### Meeting Events
- `join-room` - Join a meeting room
- `leave-room` - Leave a meeting room
- `user-joined` - User joined notification
- `user-left` - User left notification

### WebRTC Signaling
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate exchange

### Media Controls
- `toggle-audio` - Toggle audio mute
- `toggle-video` - Toggle video mute
- `start-screen-share` - Start screen sharing
- `stop-screen-share` - Stop screen sharing

### Chat
- `send-message` - Send chat message
- `new-message` - New message notification
- `typing` - Typing indicator

### Host Controls
- `end-meeting` - End meeting (host only)
- `remove-participant` - Remove participant (host only)

## Error Handling

All API responses follow a consistent error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Additional details (optional)",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Development

1. **Database changes**: Update `prisma/schema.prisma` and run `npm run db:push`
2. **Add new routes**: Create route files in `src/routes/`
3. **Add validation**: Create schemas in `src/schemas/`
4. **Add middleware**: Create middleware in `src/middleware/`

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a process manager like PM2
3. Set up database connection pooling
4. Configure reverse proxy (nginx)
5. Set up SSL certificates
6. Configure monitoring and logging

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify database exists
- Check firewall settings

### Authentication Issues
- Verify JWT secrets are set
- Check token expiration times
- Ensure user exists and is active

### WebSocket Issues
- Check CORS configuration
- Verify frontend URL matches
- Check firewall/proxy settings