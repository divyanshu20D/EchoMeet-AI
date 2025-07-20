# Video Conferencing Server Architecture

## 🏗️ Architecture Overview

The server follows a clean **MVC (Model-View-Controller)** architecture with a service layer for better separation of concerns and maintainability.

## 📁 Project Structure

```
server/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── authController.js
│   │   ├── meetingController.js
│   │   ├── userController.js
│   │   └── roomController.js
│   ├── services/            # Business logic layer
│   │   ├── authService.js
│   │   ├── meetingService.js
│   │   ├── userService.js
│   │   └── roomService.js
│   ├── routes/              # API route definitions
│   │   ├── auth.js
│   │   ├── meetings.js
│   │   ├── users.js
│   │   └── rooms.js
│   ├── handlers/            # WebSocket event handlers
│   │   └── socketHandler.js
│   ├── middleware/          # Express middleware
│   │   ├── auth.js
│   │   └── validation.js
│   ├── schemas/             # Zod validation schemas
│   │   ├── user.js
│   │   └── meeting.js
│   └── utils/               # Utility functions
│       ├── database.js
│       └── auth.js
├── prisma/                  # Database schema
│   └── schema.prisma
├── server.js               # Main application entry point
├── setup.js                # Database setup script
├── test-api.js            # API testing script
└── package.json
```

## 🔄 Request Flow

```
Client Request
    ↓
Express Router (routes/)
    ↓
Middleware (auth, validation)
    ↓
Controller (controllers/)
    ↓
Service (services/)
    ↓
Database (Prisma)
    ↓
Response
```

## 📋 Layer Responsibilities

### 1. **Routes Layer** (`src/routes/`)
- Define API endpoints
- Apply middleware (authentication, validation)
- Route requests to appropriate controllers
- Keep minimal logic

### 2. **Controllers Layer** (`src/controllers/`)
- Handle HTTP requests and responses
- Extract data from request objects
- Call appropriate service methods
- Format responses and handle errors
- No business logic

### 3. **Services Layer** (`src/services/`)
- Contain all business logic
- Database operations
- Data processing and validation
- Reusable across different controllers
- Return data or throw errors

### 4. **Middleware Layer** (`src/middleware/`)
- Authentication and authorization
- Request validation
- Rate limiting
- Error handling

### 5. **Handlers Layer** (`src/handlers/`)
- WebSocket event handling
- Real-time communication logic
- Socket room management

## 🔧 Key Components

### Authentication Service (`authService.js`)
```javascript
class AuthService {
  async registerUser(userData)
  async loginUser(email, password)
  async refreshToken(refreshToken)
  async logoutUser(userId)
  async changePassword(userId, currentPassword, newPassword)
  async getUserProfile(userId)
}
```

### Meeting Service (`meetingService.js`)
```javascript
class MeetingService {
  async createMeeting(hostId, meetingData)
  async getUserMeetings(userId, pagination)
  async getMeetingById(meetingId, userId)
  async updateMeeting(meetingId, hostId, updateData)
  async deleteMeeting(meetingId, hostId)
  async startMeeting(meetingId, hostId)
  async endMeeting(meetingId, hostId)
}
```

### Room Service (`roomService.js`)
```javascript
class RoomService {
  createRoom(hostName, hostId)
  getRoomById(roomId)
  joinRoom(socketId, roomId, userId, userName)
  leaveRoom(socketId)
  updateParticipantAudio(socketId, isAudioMuted)
  updateParticipantVideo(socketId, isVideoMuted)
  // ... more methods
}
```

### Socket Handler (`socketHandler.js`)
```javascript
class SocketHandler {
  handleConnection(socket)
  handleUserLeaving(socketId)
  // Handles all WebSocket events
}
```

## 🛡️ Security & Middleware

### Authentication Middleware
- JWT token verification
- User context injection
- Role-based access control

### Validation Middleware
- Zod schema validation
- Request sanitization
- Error formatting

### Security Headers
- Helmet for security headers
- CORS configuration
- Rate limiting

## 🔌 WebSocket Architecture

### Real-time Features
- Meeting room management
- WebRTC signaling (offer/answer/ICE)
- Media controls (audio/video/screen share)
- Chat messaging
- Participant management

### Socket Events
```javascript
// Join/Leave
'join-room', 'leave-room'

// WebRTC Signaling
'offer', 'answer', 'ice-candidate'

// Media Controls
'toggle-audio', 'toggle-video'
'start-screen-share', 'stop-screen-share'

// Chat
'send-message', 'typing'

// Host Controls
'end-meeting', 'remove-participant'
```

## 📊 Database Integration

### Prisma ORM
- Type-safe database operations
- Connection pooling
- Migration management
- Query optimization

### Data Models
- Users, Organizations, Meetings
- Participants, Recordings, Chat Messages
- User Sessions, Audit Logs

## 🚀 API Endpoints

### Authentication (`/api/auth`)
```
POST   /register        - User registration
POST   /login          - User login
POST   /refresh        - Token refresh
POST   /logout         - User logout
POST   /change-password - Change password
GET    /me             - Get profile
```

### Meetings (`/api/meetings`)
```
POST   /               - Create meeting
GET    /               - Get user meetings
GET    /:id            - Get meeting details
PUT    /:id            - Update meeting
DELETE /:id            - Delete meeting
POST   /:id/start      - Start meeting
POST   /:id/end        - End meeting
```

### Users (`/api/users`)
```
PUT    /profile        - Update profile
GET    /               - Get all users (admin)
GET    /:id            - Get user details (admin)
POST   /:id/activate   - Activate user (admin)
POST   /:id/deactivate - Deactivate user (admin)
```

### Rooms (`/api/rooms`)
```
POST   /               - Create room
GET    /:id            - Get room details
GET    /:id/participants - Get participants
```

## 🧪 Testing

### API Testing
```bash
npm run test:api  # Automated endpoint testing
```

### Test Coverage
- Authentication flow
- Meeting management
- User operations
- Room creation
- Error handling

## 🔄 Error Handling

### Consistent Error Format
```javascript
{
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable message',
    details: 'Additional details (optional)',
    timestamp: '2024-01-01T00:00:00.000Z'
  }
}
```

### Error Types
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Server errors (500)

## 📈 Performance Considerations

### Service Layer Benefits
- Code reusability
- Easier testing
- Better error handling
- Cleaner separation of concerns

### Database Optimization
- Connection pooling
- Query optimization
- Proper indexing
- Transaction management

## 🔧 Development Workflow

### Adding New Features
1. Create/update Zod schemas (`src/schemas/`)
2. Implement service methods (`src/services/`)
3. Create controller methods (`src/controllers/`)
4. Define routes (`src/routes/`)
5. Add middleware if needed (`src/middleware/`)
6. Update tests

### Code Organization Benefits
- **Maintainability**: Clear separation of concerns
- **Testability**: Each layer can be tested independently
- **Scalability**: Easy to add new features
- **Reusability**: Services can be used across controllers
- **Debugging**: Easier to trace issues through layers

## 🚀 Deployment Ready

The refactored architecture provides:
- Clean code structure
- Better error handling
- Improved maintainability
- Enhanced testability
- Production-ready organization

This architecture follows industry best practices and makes the codebase much more maintainable and scalable for future development.