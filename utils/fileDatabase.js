const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class FileDatabase {
  constructor() {
    // Use Railway storage or local
    this.isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    
    if (this.isRailway) {
      // For Railway, try persistent volume first, fallback to app storage
      this.dataPath = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data';
    } else {
      this.dataPath = path.join(__dirname, '..', 'data');
    }
    
    this.usersFile = path.join(this.dataPath, 'users.json');
    this.productsFile = path.join(this.dataPath, 'products.json');
    this.recordsFile = path.join(this.dataPath, 'records.json');
    this.backupsFile = path.join(this.dataPath, 'backups.json');
    
    this.initialized = false;
  }

  async initialize() {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataPath, { recursive: true });
      
      // Initialize data files if they don't exist
      await this.initializeFile(this.usersFile, []);
      await this.initializeFile(this.productsFile, this.getDefaultProducts());
      await this.initializeFile(this.recordsFile, []);
      await this.initializeFile(this.backupsFile, []);
      
      // Create default admin user if no users exist
      const users = await this.getUsers();
      if (users.length === 0) {
        await this.createDefaultAdmin();
      }
      
      this.initialized = true;
      console.log('✅ File-based database initialized');
      console.log(`📁 Data path: ${this.dataPath}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize file database:', error);
      this.initialized = false;
      return false;
    }
  }

  async initializeFile(filePath, defaultData) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
      console.log(`📄 Created: ${path.basename(filePath)}`);
    }
  }

  // ============ USER MANAGEMENT ============

  async getUsers() {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading users:', error);
      return [];
    }
  }

  async getUserById(id) {
    const users = await this.getUsers();
    return users.find(u => u._id === id);
  }

  async getUserByEmail(email) {
    const users = await this.getUsers();
    return users.find(u => u.email === email.toLowerCase());
  }

  async createUser(userData) {
    const users = await this.getUsers();
    
    // Check if user already exists
    if (users.find(u => u.email === userData.email.toLowerCase())) {
      throw new Error('User already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    // Create user object
    const user = {
      _id: this.generateId(),
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      role: userData.role || 'employee',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      permissions: this.getPermissionsByRole(userData.role || 'employee')
    };
    
    users.push(user);
    await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
    
    // Return user without password
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async validateUserPassword(email, password) {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    // Update last login
    const users = await this.getUsers();
    const userIndex = users.findIndex(u => u._id === user._id);
    users[userIndex].lastLogin = new Date().toISOString();
    await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
    
    // Return user without password
    const { password: _, ...safeUser } = users[userIndex];
    return safeUser;
  }

  async createDefaultAdmin() {
    console.log('📱 Creating default admin user...');
    
    const admin = await this.createUser({
      name: 'Administrador',
      email: 'admin@conejonegro.com',
      password: 'admin123',
      role: 'admin'
    });
    
    console.log('✅ Default admin created');
    console.log('📧 Email: admin@conejonegro.com');
    console.log('🔑 Password: admin123');
    console.log('⚠️ Please change the password after first login!');
    
    return admin;
  }

  getPermissionsByRole(role) {
    switch (role) {
      case 'admin':
        return {
          canManageInventory: true,
          canRegisterClients: true,
          canViewReports: true,
          canManageUsers: true,
          canExportData: true,
          canDeleteRecords: true
        };
      case 'manager':
        return {
          canManageInventory: true,
          canRegisterClients: true,
          canViewReports: true,
          canManageUsers: false,
          canExportData: true,
          canDeleteRecords: true
        };
      default: // employee
        return {
          canManageInventory: true,
          canRegisterClients: true,
          canViewReports: true,
          canManageUsers: false,
          canExportData: false,
          canDeleteRecords: false
        };
    }
  }

  // ============ PRODUCT MANAGEMENT ============

  async getProducts() {
    try {
      const data = await fs.readFile(this.productsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading products:', error);
      return [];
    }
  }

  async getProductById(id) {
    const products = await this.getProducts();
    return products.find(p => p._id === id);
  }

  async createProduct(productData) {
    const products = await this.getProducts();
    
    const product = {
      _id: this.generateId(),
      name: productData.name,
      category: productData.category,
      quantity: productData.quantity || 0,
      cost: productData.cost || 0,
      price: productData.price || 0,
      lowStockAlert: productData.lowStockAlert || 5,
      description: productData.description || '',
      barcode: productData.barcode || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: productData.createdBy
    };
    
    products.push(product);
    await fs.writeFile(this.productsFile, JSON.stringify(products, null, 2));
    
    return product;
  }

  async updateProduct(id, updateData) {
    const products = await this.getProducts();
    const index = products.findIndex(p => p._id === id);
    
    if (index === -1) {
      throw new Error('Product not found');
    }
    
    products[index] = {
      ...products[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(this.productsFile, JSON.stringify(products, null, 2));
    return products[index];
  }

  async updateProductStock(id, quantity, operation = 'set') {
    const products = await this.getProducts();
    const index = products.findIndex(p => p._id === id);
    
    if (index === -1) {
      throw new Error('Product not found');
    }
    
    switch (operation) {
      case 'add':
        products[index].quantity += quantity;
        break;
      case 'subtract':
        products[index].quantity = Math.max(0, products[index].quantity - quantity);
        break;
      default: // set
        products[index].quantity = Math.max(0, quantity);
    }
    
    products[index].updatedAt = new Date().toISOString();
    await fs.writeFile(this.productsFile, JSON.stringify(products, null, 2));
    
    return products[index];
  }

  async deleteProduct(id) {
    const products = await this.getProducts();
    const index = products.findIndex(p => p._id === id);
    
    if (index === -1) {
      throw new Error('Product not found');
    }
    
    // Soft delete
    products[index].isActive = false;
    products[index].deletedAt = new Date().toISOString();
    
    await fs.writeFile(this.productsFile, JSON.stringify(products, null, 2));
    return { success: true };
  }

  getDefaultProducts() {
    return [
      // Cafetería products
      {
        _id: this.generateId(),
        name: 'Espresso',
        category: 'cafeteria',
        quantity: 50,
        cost: 10,
        price: 35,
        lowStockAlert: 10,
        description: 'Café espresso tradicional',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        _id: this.generateId(),
        name: 'Americano',
        category: 'cafeteria',
        quantity: 45,
        cost: 12,
        price: 40,
        lowStockAlert: 10,
        description: 'Café americano suave',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        _id: this.generateId(),
        name: 'Capuccino',
        category: 'cafeteria',
        quantity: 40,
        cost: 15,
        price: 45,
        lowStockAlert: 10,
        description: 'Capuccino cremoso',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        _id: this.generateId(),
        name: 'Latte',
        category: 'cafeteria',
        quantity: 35,
        cost: 12,
        price: 40,
        lowStockAlert: 10,
        description: 'Latte con leche vaporizada',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      // Refrigerador products
      {
        _id: this.generateId(),
        name: 'Coca-Cola',
        category: 'refrigerador',
        quantity: 24,
        cost: 15,
        price: 25,
        lowStockAlert: 6,
        description: 'Refresco de cola 355ml',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        _id: this.generateId(),
        name: 'Agua Mineral',
        category: 'refrigerador',
        quantity: 30,
        cost: 8,
        price: 15,
        lowStockAlert: 10,
        description: 'Agua mineral 500ml',
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        _id: this.generateId(),
        name: 'Jugo de Naranja',
        category: 'refrigerador',
        quantity: 15,
        cost: 20,
        price: 35,
        lowStockAlert: 5,
        description: 'Jugo de naranja natural 500ml',
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];
  }

  // ============ RECORDS MANAGEMENT ============

  async getRecords() {
    try {
      const data = await fs.readFile(this.recordsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading records:', error);
      return [];
    }
  }

  async getRecordById(id) {
    const records = await this.getRecords();
    return records.find(r => r._id === id);
  }

  async createRecord(recordData) {
    const records = await this.getRecords();
    
    // Calculate totals from products array
    let totalCost = 0;
    let totalPrice = 0;
    
    // Handle both old single-product format and new multi-product format
    let products = [];
    
    if (recordData.products && Array.isArray(recordData.products)) {
      // New multi-product format
      products = recordData.products;
      
      for (const item of products) {
        totalCost += (item.cost * item.quantity);
        totalPrice += (item.price * item.quantity);
      }
    } else {
      // Legacy single-product format - convert to multi-product
      if (recordData.drinkProduct) {
        const product = await this.getProductById(recordData.drinkProduct);
        if (product) {
          products = [{
            productId: recordData.drinkProduct,
            name: recordData.drink || product.name,
            quantity: 1,
            price: product.price,
            cost: product.cost,
            category: product.category
          }];
          totalCost = product.cost;
          totalPrice = product.price;
        }
      }
    }

    // Manejar lógica de coworking: bebidas no se cobran pero sí se descuentan del reporte
    let finalTotal = totalPrice;
    let finalCost = totalCost;
    let subtotal = totalPrice;
    let serviceCharge = 0;
    
    if (recordData.service === 'coworking') {
      const coworkingRate = 58; // $58 per hour
      serviceCharge = coworkingRate * (recordData.hours || 1);
      
      // Para coworking: separar bebidas de refrigerador de cafetería
      subtotal = 0;
      
      // Para coworking: solo cobrar productos de refrigerador
      for (const item of products) {
        if (item.category === 'refrigerador') {
          subtotal += (item.price * item.quantity);
        }
      }
      
      finalTotal = subtotal + serviceCharge; // Refrigerador items + service charge
    }
    
    // Agregar propina al total (aplicable a ambos servicios)
    const tip = parseFloat(recordData.tip) || 0;
    if (tip > 0) {
      finalTotal += tip;
    }

    const record = {
      _id: this.generateId(),
      client: recordData.client,
      service: recordData.service,
      products: products, // Array of products
      hours: recordData.hours || 1,
      subtotal: subtotal,
      serviceCharge: serviceCharge,
      total: finalTotal,
      payment: recordData.payment,
      cost: finalCost,
      profit: finalTotal - finalCost,
      drinksCost: recordData.drinksCost || 0, // Para tracking en coworking
      tip: tip, // Propina
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString('es-MX', { hour12: false }),
      createdBy: recordData.createdBy,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      
      // Legacy fields for backward compatibility
      drink: products.length > 0 ? products[0].name : null,
      drinkProduct: products.length > 0 ? products[0].productId : null
    };
    
    records.push(record);
    await fs.writeFile(this.recordsFile, JSON.stringify(records, null, 2));
    
    // Update product stock for all products
    for (const item of products) {
      await this.updateProductStock(item.productId, item.quantity, 'subtract');
    }
    
    return record;
  }

  async deleteRecord(id, deletedBy) {
    const records = await this.getRecords();
    const index = records.findIndex(r => r._id === id);
    
    if (index === -1) {
      throw new Error('Record not found');
    }
    
    // Soft delete
    records[index].isDeleted = true;
    records[index].deletedAt = new Date().toISOString();
    records[index].deletedBy = deletedBy;
    
    await fs.writeFile(this.recordsFile, JSON.stringify(records, null, 2));
    
    // Return stock for all products
    if (records[index].products && Array.isArray(records[index].products)) {
      // New multi-product format
      for (const item of records[index].products) {
        await this.updateProductStock(item.productId, item.quantity, 'add');
      }
    } else if (records[index].drinkProduct) {
      // Legacy single-product format
      await this.updateProductStock(records[index].drinkProduct, 1, 'add');
    }
    
    return { success: true };
  }

  async getRecordsByDateRange(startDate, endDate) {
    const records = await this.getRecords();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return records.filter(r => {
      const recordDate = new Date(r.date);
      return !r.isDeleted && recordDate >= start && recordDate <= end;
    });
  }

  async getTodayRecords() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    return this.getRecordsByDateRange(startOfDay, endOfDay);
  }

  async getStatsByDateRange(startDate, endDate) {
    const records = await this.getRecordsByDateRange(startDate, endDate);
    
    const stats = {
      totalRecords: records.length,
      totalIncome: 0,
      totalCost: 0,
      totalProfit: 0,
      averageTicket: 0,
      paymentBreakdown: {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0
      },
      serviceBreakdown: {
        cafeteria: 0,
        coworking: 0
      }
    };
    
    records.forEach(record => {
      stats.totalIncome += record.total;
      stats.totalCost += record.cost;
      stats.totalProfit += record.profit;
      
      if (record.payment) {
        stats.paymentBreakdown[record.payment] = (stats.paymentBreakdown[record.payment] || 0) + 1;
      }
      
      if (record.service) {
        stats.serviceBreakdown[record.service] = (stats.serviceBreakdown[record.service] || 0) + 1;
      }
    });
    
    stats.averageTicket = stats.totalRecords > 0 ? stats.totalIncome / stats.totalRecords : 0;
    
    // Round to 2 decimal places
    stats.totalIncome = Math.round(stats.totalIncome * 100) / 100;
    stats.totalCost = Math.round(stats.totalCost * 100) / 100;
    stats.totalProfit = Math.round(stats.totalProfit * 100) / 100;
    stats.averageTicket = Math.round(stats.averageTicket * 100) / 100;
    
    return stats;
  }

  // ============ UTILITIES ============

  generateId() {
    return crypto.randomBytes(12).toString('hex');
  }

  generateToken(user) {
    // Fixed secret key for consistent JWT across all environments
    const secret = 'a3aa6a461b5ec2db6ace95b5a9612583d213a8d69df9bf1c1679bcbe8559a8fd';
    
    return jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      },
      secret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token) {
    try {
      // Fixed secret key - must match generateToken exactly
      const secret = 'a3aa6a461b5ec2db6ace95b5a9612583d213a8d69df9bf1c1679bcbe8559a8fd';
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
const fileDatabase = new FileDatabase();

module.exports = fileDatabase;