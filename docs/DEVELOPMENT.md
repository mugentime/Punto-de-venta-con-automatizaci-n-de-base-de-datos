# Development Setup Guide

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd POS-CONEJONEGRO
   npm run setup:full
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your values
   nano .env  # or use your preferred editor
   ```

3. **Database Setup**
   ```bash
   # Initialize database with admin user
   npm run setup:db
   
   # Or manually run
   node initDatabase.js
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for complete configuration options. Key variables:

- `DATABASE_URL`: PostgreSQL connection string (production)
- `JWT_SECRET`: JWT signing secret
- `PORT`: Application port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## Database Configuration

### PostgreSQL (Production/Railway)
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

### File-based Storage (Development Fallback)
If `DATABASE_URL` is not set, the system uses JSON files in `/data/` directory.

## Development Commands

### Core Development
- `npm run dev` - Start development server with auto-reload
- `npm run dev:watch` - Watch specific directories for changes
- `npm run dev:debug` - Start with Node.js debugger
- `npm run setup:full` - Complete setup (env + install + db)

### Database Management
- `npm run setup:db` - Initialize database with admin user
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset and reseed database

### Testing
- `npm test` - Run all tests
- `npm run test:unit` - Unit tests only
- `npm run test:integration` - Integration tests
- `npm run test:e2e` - End-to-end tests
- `npm run test:coverage` - Test coverage report
- `npm run test:watch` - Watch mode for tests

### Code Quality
- `npm run lint` - Run linter
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Monitoring
- `npm run health` - Check application health
- `npm run logs` - View application logs
- `npm run logs:error` - View error logs only

## Project Structure

```
├── server.js              # Main application entry
├── initDatabase.js         # Database initialization
├── routes/                 # API routes
│   ├── auth.js            # Authentication
│   ├── products-file.js   # Products (file-based)
│   ├── records-file.js    # Sales records
│   └── ...                # Other routes
├── middleware/            # Express middleware
│   └── auth.js           # Authentication middleware
├── utils/                # Utility modules
│   ├── database.js       # Database abstraction
│   ├── cloudStorage.js   # Cloud storage service
│   └── ...               # Other utilities
├── models/               # Data models
├── data/                 # File-based storage (development)
├── tests/                # Test files
└── docs/                 # Documentation
```

## Authentication

Default admin user:
- Email: `admin@conejonegro.com`
- Password: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user
- `GET /api/auth/verify` - Verify JWT token

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Sales Records
- `GET /api/records` - List sales records
- `POST /api/records` - Create sales record
- `PUT /api/records/:id` - Update record
- `DELETE /api/records/:id` - Delete record

### Cash Cuts
- `GET /api/cashcuts` - List cash cuts
- `POST /api/cashcuts` - Create cash cut
- `PUT /api/cashcuts/:id` - Update cash cut

## Database Schema

### Users
- `id` (Primary Key)
- `email` (Unique)
- `password` (Hashed)
- `role` (admin/manager/employee)
- `firstName`, `lastName`
- `createdAt`, `updatedAt`

### Products
- `id` (Primary Key)
- `name`
- `price`
- `category` (cafeteria/refrigerador)
- `stock`
- `active`

### Records (Sales)
- `id` (Primary Key)
- `products` (JSON array)
- `total`
- `clientType`
- `serviceType`
- `timestamp`

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- CORS configuration
- Helmet security headers
- Input validation

## Deployment

### Railway (Production)
1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main branch

### Local Production Test
```bash
NODE_ENV=production npm start
```

## Troubleshooting

### Database Connection Issues
1. Check `DATABASE_URL` in environment
2. Verify PostgreSQL service is running
3. Fallback to file-based storage will occur automatically

### Authentication Issues
1. Verify JWT_SECRET is set
2. Check admin user exists: `npm run bootstrap:admin`
3. Reset admin user: `npm run emergency:fix-admin`

### Performance Issues
1. Check logs: `npm run logs`
2. Monitor memory: `npm run test:performance:memory`
3. Run health check: `npm run health`

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/name`
3. Run tests: `npm test`
4. Commit changes: `git commit -am 'Add feature'`
5. Push to branch: `git push origin feature/name`
6. Create Pull Request

## Support

- Check application logs for errors
- Review environment configuration
- Verify database connectivity
- Test API endpoints with included scripts