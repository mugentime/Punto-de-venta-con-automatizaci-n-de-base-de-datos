const ERROR_MESSAGES = {
  UNAUTHORIZED: 'No autorizado',
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  USER_NOT_FOUND: 'Usuario no encontrado',
  PRODUCT_NOT_FOUND: 'Producto no encontrado',
  INSUFFICIENT_STOCK: 'Stock insuficiente',
  INVALID_DATA: 'Datos inválidos'
};

const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  PRODUCT_CREATED: 'Producto creado exitosamente',
  SALE_COMPLETED: 'Venta completada exitosamente',
  USER_CREATED: 'Usuario creado exitosamente'
};

module.exports = {
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || 'production',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'conejo-negro-pos-2025',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'gerencia@conejonegro.mx',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'conejonegro2024',
  DATA_PERSIST: process.env.DATA_PERSIST === 'true',
  CREATE_DEFAULT_USERS: process.env.CREATE_DEFAULT_USERS === 'true',
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};