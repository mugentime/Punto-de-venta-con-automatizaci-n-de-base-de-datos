# Información de Autenticación - POS Conejo Negro

## 🔐 Credenciales de Acceso

### Usuarios del Sistema
```
Admin:
- Email: admin@conejo.com
- Password: admin123
- Role: admin

Empleado:
- Email: empleado@conejo.com  
- Password: empleado123
- Role: employee
```

## 🚀 Railway Project Info

### Project ID
```
fed11c6d-a65a-4d93-90e6-955e16b6753f
```

### Railway API Token
```
9e6136f9-805d-45b3-9ff8-7226a03a0af5
```

### Service IDs
- POS Service: `72109cc7-28c6-48c9-871b-1bb4fe8faedf`
- PostgreSQL: `feab70f0-9317-4f20-91eb-6c81cc040560`
- Environment: `7bf2a439-4f31-4565-92ae-9c18bd76e0b8`

## 🗄️ Base de Datos PostgreSQL

### Conexión Interna (Railway)
```
DATABASE_URL=postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/railway
```

### Conexión Externa (Public)
```
DATABASE_PUBLIC_URL=postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@caboose.proxy.rlwy.net:27640/railway
```

### Credenciales DB
- User: `postgres`
- Password: `aezVREfCHRpQHBfwweXHEaANsbeIMeno`
- Database: `railway`
- Port interno: `5432`
- Port público: `27640`

## 🔑 JWT Configuration

```javascript
JWT_SECRET=conejo-negro-pos-2025
```

## 🌐 URLs del Sistema

### Producción
```
https://pos-conejonegro-production.up.railway.app
```

### Endpoints API
- Login: `POST /api/auth/login`
- Register: `POST /api/auth/register`
- Products: `GET /api/products`
- Records: `GET /api/records`
- Cash Cuts: `GET /api/cashcuts`

## 📝 Variables de Entorno (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@caboose.proxy.rlwy.net:27640/railway
NODE_ENV=production

# JWT
JWT_SECRET=conejo-negro-pos-2025

# Railway
RAILWAY_ENVIRONMENT=production
RAILWAY_PROJECT_ID=fed11c6d-a65a-4d93-90e6-955e16b6753f
```

## 🛠️ Scripts Útiles

### Crear Usuario Admin
```javascript
// createAdmin.js
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@caboose.proxy.rlwy.net:27640/railway',
    ssl: { rejectUnauthorized: false }
});

const hash = await bcrypt.hash('admin123', 10);
await pool.query(
    'INSERT INTO users (_id, username, password, role, permissions, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
    ['admin_' + Date.now(), 'admin@conejo.com', hash, 'admin', '{}', true]
);
```

### Fix de Autenticación (Consola Browser)
```javascript
// Ejecutar en consola del navegador
localStorage.setItem('token', 'bypass');
localStorage.setItem('userEmail', 'admin@conejo.com');
localStorage.setItem('userRole', 'admin');
location.reload();
```

## 🐛 Solución Error 401

El error 401 ocurre cuando el JWT_SECRET no coincide. Asegurarse que:
1. El servidor use: `JWT_SECRET=conejo-negro-pos-2025`
2. El middleware valide con el mismo secret
3. Los tokens se generen con el mismo secret

---
Última actualización: 29/08/2025