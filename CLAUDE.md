# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
- `npm install` - Install dependencies
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run setup` - Initialize database with admin user (admin/admin123)

### Database Initialization
- `node initDatabase.js` - Manually run database initialization
- Default admin user: admin@conejonegro.com / admin123

## Architecture Overview

This is a Point of Sale system for Conejo Negro Café with dual storage support:

### Database Layer
- **Primary**: PostgreSQL (via DATABASE_URL environment variable)
- **Fallback**: File-based storage in `/data/` directory
- Database abstraction handled by `utils/database.js`

### File Structure
- **Routes**: API endpoints split between database (`routes/*-file.js`) and PostgreSQL versions
- **Models**: Database models in `/models/` directory
- **Middleware**: Authentication middleware in `/middleware/`
- **Utils**: Services including cloud storage, backup service, and scheduler

### Key Components
- **Authentication**: JWT-based with role permissions (admin/manager/employee)
- **Inventory**: Products for cafetería and refrigerador categories
- **Sales**: Transaction recording with client types and service types
- **Backups**: Automated Google Drive backups with scheduling
- **Cloud Storage**: Integration with multiple cloud providers

### Deployment
- **Railway**: Primary deployment platform with PostgreSQL addon
- **Environment Variables**: Stored in Railway dashboard
- **File Storage**: Uses Railway's persistent volumes or cloud storage
- **CORS**: Configured for Railway domain in production

### Security
- CSP headers configured for inline scripts and CDNs
- Rate limiting enabled
- JWT authentication with bcrypt password hashing
- Role-based permissions system

## Database Schema
- Users: Authentication and permissions
- Products: Inventory with categories and stock
- Records: Sales transactions with client and service data
- Backups: Backup metadata and scheduling
- CashCuts: Daily cash register cuts

## Critical Files
- `server.js` - Main application entry point
- `utils/database.js` - Database abstraction layer
- `initDatabase.js` - Database initialization and seeding
- `package.json` - Dependencies and npm scripts