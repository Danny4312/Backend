# iSafari Global Backend API

A robust Node.js/Express backend API for the iSafari Global travel platform with PostgreSQL database integration and Google OAuth authentication.

## Features

- **Role-based Authentication**: Support for travelers and service providers
- **Google OAuth Integration**: Seamless login with Google accounts
- **PostgreSQL Database**: Scalable database with proper relationships
- **JWT Authentication**: Secure token-based authentication
- **RESTful API**: Well-structured endpoints for all operations
- **Data Isolation**: Users only see their own data based on roles
- **Real Booking System**: Complete booking workflow between travelers and providers

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: Passport.js (Google OAuth + JWT)
- **Validation**: Joi + express-validator
- **Security**: Helmet, CORS, Rate limiting

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Google OAuth credentials

### Installation

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=isafari_global
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d

   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

   # Server Configuration
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:4028
   ```

3. **Set up PostgreSQL database**:
   - Create a new database named `isafari_global`
   - The application will automatically create all required tables on startup

4. **Start the server**:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication (`/api/auth`)

- `POST /register` - Register new user
- `POST /login` - Login with email/password
- `GET /google` - Initiate Google OAuth
- `GET /google/callback` - Google OAuth callback
- `POST /google/complete` - Complete Google registration
- `GET /google/temp` - Get temporary Google user data
- `GET /verify` - Verify JWT token

### Users (`/api/users`)

- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `PUT /business-profile` - Update business profile (providers only)
- `GET /dashboard-stats` - Get dashboard statistics

### Services (`/api/services`)

- `GET /` - Get all services (public)
- `GET /:id` - Get service by ID
- `GET /provider/my-services` - Get provider's services
- `POST /` - Create new service (providers only)
- `PUT /:id` - Update service (providers only)
- `DELETE /:id` - Delete service (providers only)

### Bookings (`/api/bookings`)

- `GET /` - Get user's bookings
- `GET /:id` - Get booking by ID
- `POST /` - Create new booking (travelers only)
- `PUT /:id/status` - Update booking status
- `PUT /:id/payment` - Update payment status
- `POST /:id/review` - Add review (travelers only)

## Database Schema

### Users Table
- Basic user information
- Role-based access (traveler/service_provider)
- Google OAuth integration

### Service Providers Table
- Business profile information
- Ratings and verification status
- Location and contact details

### Services Table
- Service listings with details
- Pricing and availability
- Images and amenities

### Bookings Table
- Booking requests and confirmations
- Payment tracking
- Status management

### Reviews Table
- User reviews and ratings
- Linked to completed bookings

## Authentication Flow

### Regular Registration/Login
1. User registers with email/password
2. Backend validates and creates user
3. JWT token returned for authentication
4. Token used for subsequent API calls

### Google OAuth Flow
1. User clicks "Login with Google"
2. Redirected to Google OAuth
3. If new user, redirected to complete registration
4. If existing user, logged in automatically
5. JWT token provided for API access

## Role-Based Access

### Travelers
- Can browse and book services
- View their booking history
- Leave reviews for completed bookings
- Manage their profile

### Service Providers
- Can create and manage services
- View and manage bookings for their services
- Update business profile
- View analytics and earnings

## Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: Prevent API abuse
- **CORS Protection**: Controlled cross-origin requests
- **Helmet**: Security headers
- **Input Validation**: Comprehensive validation
- **SQL Injection Protection**: Parameterized queries

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
backend/
├── config/          # Database and passport configuration
├── routes/          # API route handlers
├── middleware/      # Custom middleware
├── .env.example     # Environment variables template
├── server.js        # Main application entry point
└── package.json     # Dependencies and scripts
```

### Adding New Features
1. Create route handlers in `routes/`
2. Add validation rules in `middleware/validation.js`
3. Update database schema if needed
4. Add tests for new functionality

## Deployment

### Environment Setup
- Set `NODE_ENV=production`
- Use secure JWT secret
- Configure production database
- Set up proper CORS origins
- Enable HTTPS

### Database Migration
The application automatically creates tables on startup. For production:
1. Run database initialization manually
2. Set up proper backup procedures
3. Configure connection pooling

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection credentials
   - Ensure database exists

2. **Google OAuth Not Working**
   - Verify Google OAuth credentials
   - Check callback URL configuration
   - Ensure frontend URL is correct

3. **JWT Token Invalid**
   - Check JWT secret configuration
   - Verify token expiration settings
   - Clear localStorage and re-login

### Logging
- Development: Console logging enabled
- Production: Configure proper logging service
- Error tracking: Implement error monitoring

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details
