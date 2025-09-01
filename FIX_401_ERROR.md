# Soluciones para Error 401 - POS Conejo Negro

## Ejecutar estos comandos en orden:

### 1. Aplicar fix del middleware
```bash
cd C:\Users\je2al\Desktop\POS-CONEJONEGRO
node fixAuthMiddleware.js
```

### 2. Recrear usuario admin
```bash
node recreateAdmin.js
```

### 3. Commit y push a Railway
```bash
git add -A
git commit -m "Fix JWT authentication middleware"
git push origin main
```

### 4. Esperar 2-3 minutos para el deploy

### 5. Si aún no funciona, usar bypass temporal

En la consola del navegador (F12) en https://pos-conejonegro-production.up.railway.app:

```javascript
// Limpiar cache
localStorage.clear();

// Establecer bypass
localStorage.setItem('token', 'bypass');
localStorage.setItem('userEmail', 'admin@conejo.com');
localStorage.setItem('userRole', 'admin');

// Recargar
location.reload();
```

## Credenciales
- Email: `admin@conejo.com`
- Password: `admin123`
