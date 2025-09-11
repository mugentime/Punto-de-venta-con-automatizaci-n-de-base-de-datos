# Clean Architecture Refactoring Plan

## Proposed Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Frameworks & Drivers                     │
├─────────────────────────────────────────────────────────────┤
│  Express.js │ PostgreSQL │ File System │ JWT │ BCrypt      │
├─────────────────────────────────────────────────────────────┤
│                Interface Adapters (Controllers)             │
├─────────────────────────────────────────────────────────────┤
│  REST API │ Middleware │ Request/Response │ Validation      │
├─────────────────────────────────────────────────────────────┤
│                    Use Cases (Services)                     │
├─────────────────────────────────────────────────────────────┤
│  AuthService │ ProductService │ RecordService │ UserService │
├─────────────────────────────────────────────────────────────┤
│                   Entities (Domain Models)                  │
├─────────────────────────────────────────────────────────────┤
│     User │ Product │ Record │ CashCut │ Session            │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── controllers/           # HTTP request handlers
├── services/             # Business logic layer
├── repositories/         # Data access layer
├── entities/            # Domain models
├── middleware/          # Express middleware
├── validators/          # Input validation
├── config/              # Configuration
├── utils/               # Shared utilities
└── types/               # TypeScript definitions
```

## Key Benefits

1. **Dependency Inversion**: High-level modules don't depend on low-level modules
2. **Testability**: Each layer can be tested independently
3. **Maintainability**: Clear separation of concerns
4. **Scalability**: Easy to add new features without affecting existing code
5. **Technology Independence**: Easy to swap implementations