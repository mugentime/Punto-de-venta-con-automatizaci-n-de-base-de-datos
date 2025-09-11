# TypeScript Migration Strategy for POS System

## Migration Approach: Gradual TypeScript Adoption

### Phase 1: Foundation Setup (Week 1-2)

#### 1.1 TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests/**/*"]
}
```

#### 1.2 Package.json Updates
```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev:ts": "ts-node-dev --respawn --transpile-only src/server.ts",
    "typecheck": "tsc --noEmit",
    "migration:check": "tsc --noEmit --allowJs"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/helmet": "^4.0.0",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/bcryptjs": "^2.4.2",
    "@types/multer": "^1.4.7",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

### Phase 2: Core Types Definition (Week 3-4)

#### 2.1 Domain Entity Types
```typescript
// src/types/entities.ts
export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  permissions: UserPermissions;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserPermissions {
  canManageInventory?: boolean;
  canRegisterClients?: boolean;
  canViewReports?: boolean;
  canManageUsers?: boolean;
  canExportData?: boolean;
  canDeleteRecords?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  quantity: number;
  cost: number;
  price: number;
  lowStockAlert: number;
  description?: string;
  barcode?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCategory = 'cafetería' | 'refrigerador' | 'otros';
```

#### 2.2 API Response Types
```typescript
// src/types/api.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  correlationId?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuthResponse extends ApiResponse<User> {
  token: string;
  expiresIn: string;
}
```

### Phase 3: Repository Layer Migration (Week 5-6)

#### 3.1 Repository Interfaces
```typescript
// src/repositories/interfaces/IUserRepository.ts
import { User, UserRole } from '../../types/entities';

export interface FindUserFilters {
  role?: UserRole;
  isActive?: boolean;
  limit?: number;
  page?: number;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(filters?: FindUserFilters): Promise<User[]>;
  create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: string, userData: Partial<User>): Promise<User>;
  delete(id: string): Promise<boolean>;
  exists(email: string): Promise<boolean>;
  count(filters?: FindUserFilters): Promise<number>;
  verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean>;
}
```

#### 3.2 Service Layer Migration
```typescript
// src/services/AuthService.ts
import { IUserRepository } from '../repositories/interfaces/IUserRepository';
import { User, UserRole } from '../types/entities';
import { AuthResponse, ApiResponse } from '../types/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export class AuthService {
  constructor(
    private userRepository: IUserRepository,
    private jwtSecret: string = process.env.JWT_SECRET || 'fallback-secret'
  ) {}

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    // Implementation with full type safety
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    // Implementation with full type safety
  }
}
```

### Phase 4: Migration Priority Order

#### High Priority (Weeks 1-8)
1. **Core Types & Interfaces**
2. **Repository Layer** - Data access with type safety
3. **Service Layer** - Business logic with interfaces
4. **Error Handling** - Typed error classes
5. **Validation Middleware** - Type-safe validation

#### Medium Priority (Weeks 9-12)
1. **Controllers** - HTTP request/response typing
2. **Route Handlers** - Express with TypeScript
3. **Middleware** - Authentication, logging, etc.
4. **Database Models** - PostgreSQL/File abstractions

#### Low Priority (Weeks 13-16)
1. **Utilities** - Helper functions
2. **Configuration** - Environment variables
3. **Scripts** - Build and deployment scripts

### Phase 5: Testing Strategy

#### 5.1 Jest Configuration
```typescript
// jest.config.ts
import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};

export default config;
```

#### 5.2 Type-Safe Tests
```typescript
// tests/unit/services/AuthService.test.ts
import { AuthService } from '../../../src/services/AuthService';
import { IUserRepository } from '../../../src/repositories/interfaces/IUserRepository';
import { User } from '../../../src/types/entities';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      verifyPassword: jest.fn(),
    } as any;
    
    authService = new AuthService(mockUserRepository, 'test-secret');
  });

  it('should login user with valid credentials', async () => {
    const mockUser: User = {
      id: '1',
      email: 'test@test.com',
      name: 'Test User',
      password: 'hashed-password',
      role: 'employee',
      permissions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockUserRepository.findByEmail.mockResolvedValue(mockUser);
    mockUserRepository.verifyPassword.mockResolvedValue(true);

    const result = await authService.login({
      email: 'test@test.com',
      password: 'password'
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });
});
```

### Phase 6: Development Workflow

#### 6.1 Gradual Migration Commands
```bash
# Check current TypeScript compatibility
npm run migration:check

# Start development with TypeScript
npm run dev:ts

# Type checking during development
npm run typecheck

# Build TypeScript to JavaScript
npm run build
```

#### 6.2 IDE Configuration
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

### Phase 7: Benefits & Success Metrics

#### Immediate Benefits
- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: IntelliSense, refactoring, navigation
- **Code Documentation**: Self-documenting interfaces
- **Refactoring Confidence**: Safe large-scale changes

#### Success Metrics
- Reduce runtime type errors by 80%
- Improve development velocity by 25%
- Increase code coverage to >90%
- Reduce bug reports by 60%

### Migration Timeline

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| 1 | 2 weeks | Setup & Config | TypeScript tooling |
| 2 | 2 weeks | Core Types | Entity & API types |
| 3 | 2 weeks | Data Layer | Repositories in TS |
| 4 | 2 weeks | Business Logic | Services in TS |
| 5 | 2 weeks | API Layer | Controllers in TS |
| 6 | 2 weeks | Testing | Type-safe tests |
| 7 | 2 weeks | Optimization | Performance & cleanup |
| 8 | 2 weeks | Documentation | Migration docs |

### Risk Mitigation

1. **Parallel Development**: Keep JavaScript version running
2. **Incremental Migration**: One module at a time
3. **Comprehensive Testing**: Both JS and TS versions
4. **Team Training**: TypeScript workshops
5. **Rollback Plan**: Can revert to JavaScript anytime

This gradual migration ensures minimal disruption while providing maximum benefits of TypeScript adoption.