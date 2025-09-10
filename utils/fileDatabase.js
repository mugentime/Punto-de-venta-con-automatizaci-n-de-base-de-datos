const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class FileDatabase {
  constructor() {
    // Use Render storage or local
    this.isRender = process.env.RENDER || process.env.NODE_ENV === 'production';
    
    if (this.isRender) {
      // For Render, use project source directory
      this.dataPath = '/opt/render/project/src/data';
    } else {
      this.dataPath = path.join(__dirname, '..', 'data');
    }
    
    this.usersFile = path.join(this.dataPath, 'users.json');
    this.productsFile = path.join(this.dataPath, 'products.json');
    this.recordsFile = path.join(this.dataPath, 'records.json');
    this.cashCutsFile = path.join(this.dataPath, 'cash_cuts.json');
    this.membershipsFile = path.join(this.dataPath, 'memberships.json');
    this.coworkingSessionsFile = path.join(this.dataPath, 'coworking_sessions.json');
    this.customersFile = path.join(this.dataPath, 'customers.json');
    this.expensesFile = path.join(this.dataPath, 'expenses.json');
    this.backupsFile = path.join(this.dataPath, 'backups.json');
    
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('📊 Starting file database initialization...');
      console.log('📂 Using data path:', this.dataPath);
      console.log('🌐 Running in Render?', this.isRender);
      
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataPath, { recursive: true });
      console.log('🗄 Created data directory');
      
      // Try to recover from local backup first
      const recoverySuccess = await this.recoverFromBackup();
      
      // Initialize data files if they don't exist or recovery failed
      await this.initializeFile(this.usersFile, []);
      await this.initializeFile(this.productsFile, []);
      await this.initializeFile(this.recordsFile, []);
      await this.initializeFile(this.backupsFile, []);
      await this.initializeFile(this.cashCutsFile, []);
      await this.initializeFile(this.membershipsFile, []);
      await this.initializeFile(this.coworkingSessionsFile, []);
      await this.initializeFile(this.customersFile, []);
      await this.initializeFile(this.expensesFile, []);
      
      // Create default admin user if no users exist
      const users = await this.getUsers();
      if (users.length === 0) {
        await this.createDefaultAdmin();
      }
      
      this.initialized = true;
      console.log('✅ File-based database initialized');
      console.log(`📁 Data path: ${this.dataPath}`);
      if (recoverySuccess) {
        console.log('🔄 Data recovered from backup successfully');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize file database:', error);
      this.initialized = false;
      return false;
    }
  }

  async initializeFile(filePath, defaultData) {
    try {
      console.log('💿 Checking file:', path.basename(filePath));
      await fs.access(filePath);
      console.log('✅ File exists:', path.basename(filePath));
    } catch (error) {
      console.log('⚠️ File not found:', path.basename(filePath), error.code);
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
      date: recordData.historicalDate ? recordData.historicalDate.toISOString() : new Date().toISOString(),
      time: recordData.historicalDate ? recordData.historicalDate.toLocaleTimeString('es-MX', { hour12: false }) : new Date().toLocaleTimeString('es-MX', { hour12: false }),
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

  async updateRecord(id, updateData) {
    const records = await this.getRecords();
    const index = records.findIndex(r => r._id === id);
    
    if (index === -1) {
      throw new Error('Record not found');
    }
    
    records[index] = {
      ...records[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(this.recordsFile, JSON.stringify(records, null, 2));
    return records[index];
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
        userId: user.userId || user._id, // Match auth middleware expectations
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

  // === CASH CUTS METHODS ===
  async getCashCuts(limit = 50) {
    try {
      const data = await fs.readFile(this.cashCutsFile, 'utf8');
      const cashCuts = JSON.parse(data);
      
      return cashCuts
        .filter(cut => !cut.isDeleted)
        .sort((a, b) => new Date(b.cutDate) - new Date(a.cutDate))
        .slice(0, limit);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty array
        return [];
      }
      console.error('Error reading cash cuts:', error);
      return [];
    }
  }

  async getCashCutById(id) {
    try {
      const cashCuts = await this.getCashCuts();
      return cashCuts.find(cut => cut.id === id);
    } catch (error) {
      console.error('Error finding cash cut:', error);
      return null;
    }
  }

  async saveCashCut(cashCutData) {
    try {
      let cashCuts = [];
      
      try {
        const data = await fs.readFile(this.cashCutsFile, 'utf8');
        cashCuts = JSON.parse(data);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, start with empty array
        cashCuts = [];
      }
      
      // Add new cash cut
      const newCashCut = {
        ...cashCutData,
        id: cashCutData.id || this.generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      cashCuts.push(newCashCut);
      
      await fs.writeFile(this.cashCutsFile, JSON.stringify(cashCuts, null, 2));
      return newCashCut;
    } catch (error) {
      console.error('Error saving cash cut:', error);
      throw error;
    }
  }

  async deleteCashCut(id, deletedBy) {
    try {
      const data = await fs.readFile(this.cashCutsFile, 'utf8');
      const cashCuts = JSON.parse(data);
      
      const cutIndex = cashCuts.findIndex(cut => cut.id === id);
      if (cutIndex === -1) {
        throw new Error('Cash cut not found');
      }
      
      // Soft delete
      cashCuts[cutIndex].isDeleted = true;
      cashCuts[cutIndex].deletedAt = new Date().toISOString();
      cashCuts[cutIndex].deletedBy = deletedBy;
      cashCuts[cutIndex].updatedAt = new Date().toISOString();
      
      await fs.writeFile(this.cashCutsFile, JSON.stringify(cashCuts, null, 2));
      return cashCuts[cutIndex];
    } catch (error) {
      console.error('Error deleting cash cut:', error);
      throw error;
    }
  }

  // Recovery system - restore data from git repository
  async recoverFromBackup() {
    try {
      // Try to read the committed data from git repository
      const gitDataPath = path.join(__dirname, '..', 'data');
      const gitRecordsFile = path.join(gitDataPath, 'records.json');
      
      // Check if git data exists
      try {
        const gitData = await fs.readFile(gitRecordsFile, 'utf8');
        const gitRecords = JSON.parse(gitData);
        
        if (gitRecords.length > 0) {
          // Copy git data to current data directory
          await fs.copyFile(gitRecordsFile, this.recordsFile);
          
          // Also copy other files if they exist
          const filesToRecover = [
            { src: path.join(gitDataPath, 'users.json'), dest: this.usersFile },
            { src: path.join(gitDataPath, 'products.json'), dest: this.productsFile },
            { src: path.join(gitDataPath, 'backups.json'), dest: this.backupsFile }
          ];
          
          for (const file of filesToRecover) {
            try {
              await fs.copyFile(file.src, file.dest);
            } catch (err) {
              console.log(`⚠️ Could not recover ${path.basename(file.src)}: ${err.message}`);
            }
          }
          
          console.log(`🔄 Recovered ${gitRecords.length} records from git repository`);
          return true;
        }
      } catch (gitError) {
        console.log('📁 No git backup data found, using default data with your transactions');
      }
      
      return false;
    } catch (error) {
      console.error('❌ Recovery failed:', error.message);
      return false;
    }
  }

  // MEMBERSHIP METHODS
  async getMemberships(filters = {}, options = {}) {
    try {
      await this.initializeFile(this.membershipsFile, []);
      const data = await fs.readFile(this.membershipsFile, 'utf8');
      let memberships = JSON.parse(data);
      
      // Apply filters
      if (Object.keys(filters).length > 0) {
        memberships = memberships.filter(membership => {
          if (membership.isDeleted) return false;
          
          for (const [key, value] of Object.entries(filters)) {
            if (key === 'clientName' && value instanceof RegExp) {
              if (!value.test(membership.clientName)) return false;
            } else if (key === 'endDate' && typeof value === 'object' && value.$lte) {
              if (new Date(membership.endDate) > value.$lte) return false;
            } else if (membership[key] !== value) {
              return false;
            }
          }
          return true;
        });
      }
      
      // Apply sorting
      if (options.sortBy) {
        memberships.sort((a, b) => {
          const aVal = a[options.sortBy];
          const bVal = b[options.sortBy];
          
          if (options.sortOrder === 'desc') {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
          } else {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          }
        });
      }
      
      // Apply pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const paginatedMemberships = memberships.slice(startIndex, endIndex);
      
      return {
        data: paginatedMemberships,
        totalCount: memberships.length,
        currentPage: page,
        totalPages: Math.ceil(memberships.length / limit),
        hasNext: endIndex < memberships.length,
        hasPrev: page > 1
      };
    } catch (error) {
      console.error('Error getting memberships:', error);
      return { data: [], totalCount: 0, currentPage: 1, totalPages: 0, hasNext: false, hasPrev: false };
    }
  }

  async getMembershipById(id) {
    try {
      await this.initializeFile(this.membershipsFile, []);
      const data = await fs.readFile(this.membershipsFile, 'utf8');
      const memberships = JSON.parse(data);
      return memberships.find(m => m.id === id && !m.isDeleted);
    } catch (error) {
      console.error('Error getting membership by ID:', error);
      return null;
    }
  }

  async createMembership(membershipData) {
    try {
      await this.initializeFile(this.membershipsFile, []);
      const data = await fs.readFile(this.membershipsFile, 'utf8');
      const memberships = JSON.parse(data);
      
      memberships.push(membershipData);
      await fs.writeFile(this.membershipsFile, JSON.stringify(memberships, null, 2));
      
      return membershipData;
    } catch (error) {
      console.error('Error creating membership:', error);
      throw error;
    }
  }

  async updateMembership(id, updateData) {
    try {
      await this.initializeFile(this.membershipsFile, []);
      const data = await fs.readFile(this.membershipsFile, 'utf8');
      const memberships = JSON.parse(data);
      
      const membershipIndex = memberships.findIndex(m => m.id === id && !m.isDeleted);
      if (membershipIndex === -1) {
        throw new Error('Membership not found');
      }
      
      memberships[membershipIndex] = { ...memberships[membershipIndex], ...updateData };
      await fs.writeFile(this.membershipsFile, JSON.stringify(memberships, null, 2));
      
      return memberships[membershipIndex];
    } catch (error) {
      console.error('Error updating membership:', error);
      throw error;
    }
  }

  async deleteMembership(id) {
    try {
      const updateData = { isDeleted: true, updatedAt: new Date() };
      return await this.updateMembership(id, updateData);
    } catch (error) {
      console.error('Error deleting membership:', error);
      throw error;
    }
  }

  async getMembershipStats() {
    try {
      await this.initializeFile(this.membershipsFile, []);
      const data = await fs.readFile(this.membershipsFile, 'utf8');
      const memberships = JSON.parse(data).filter(m => !m.isDeleted);
      
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);
      
      const stats = {
        total: memberships.length,
        active: memberships.filter(m => m.status === 'active').length,
        expired: memberships.filter(m => m.status === 'expired').length,
        cancelled: memberships.filter(m => m.status === 'cancelled').length,
        pending: memberships.filter(m => m.status === 'pending').length,
        expiring: memberships.filter(m => 
          m.status === 'active' && new Date(m.endDate) <= threeDaysFromNow
        ).length,
        byType: {
          daily: memberships.filter(m => m.membershipType === 'daily').length,
          weekly: memberships.filter(m => m.membershipType === 'weekly').length,
          monthly: memberships.filter(m => m.membershipType === 'monthly').length
        },
        totalRevenue: memberships.reduce((sum, m) => sum + (m.price || 0), 0),
        monthlyRevenue: memberships
          .filter(m => {
            const membershipDate = new Date(m.createdAt);
            return membershipDate.getMonth() === now.getMonth() && 
                   membershipDate.getFullYear() === now.getFullYear();
          })
          .reduce((sum, m) => sum + (m.price || 0), 0)
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting membership stats:', error);
      return {
        total: 0, active: 0, expired: 0, cancelled: 0, pending: 0, expiring: 0,
        byType: { daily: 0, weekly: 0, monthly: 0 },
        totalRevenue: 0, monthlyRevenue: 0
      };
    }
  }

  // COWORKING SESSIONS
  async getCoworkingSessions() {
    try {
      await this.initializeFile(this.coworkingSessionsFile, []);
      const data = await fs.readFile(this.coworkingSessionsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading coworking sessions:', error);
      return [];
    }
  }

  async getActiveCoworkingSessions() {
    try {
      const sessions = await this.getCoworkingSessions();
      return sessions.filter(s => s.status === 'active');
    } catch (error) {
      console.error('Error getting active coworking sessions:', error);
      return [];
    }
  }

  async getCoworkingSessionById(id) {
    try {
      const sessions = await this.getCoworkingSessions();
      return sessions.find(s => s._id === id);
    } catch (error) {
      console.error('Error getting coworking session by ID:', error);
      return null;
    }
  }

  async createCoworkingSession(sessionData) {
    try {
      const sessions = await this.getCoworkingSessions();
      
      const newSession = {
        _id: sessionData._id || this.generateId(),
        client: sessionData.client,
        startTime: sessionData.startTime || new Date(),
        endTime: sessionData.endTime || null,
        status: sessionData.status || 'active',
        hourlyRate: sessionData.hourlyRate || 58,
        products: sessionData.products || [],
        notes: sessionData.notes || '',
        subtotal: sessionData.subtotal || 0,
        timeCharge: sessionData.timeCharge || 0,
        total: sessionData.total || 0,
        cost: sessionData.cost || 0,
        profit: sessionData.profit || 0,
        payment: sessionData.payment || null,
        createdBy: sessionData.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      sessions.push(newSession);
      await fs.writeFile(this.coworkingSessionsFile, JSON.stringify(sessions, null, 2));
      
      return newSession;
    } catch (error) {
      console.error('Error creating coworking session:', error);
      throw error;
    }
  }

  async updateCoworkingSession(id, updateData) {
    try {
      const sessions = await this.getCoworkingSessions();
      const sessionIndex = sessions.findIndex(s => s._id === id);

      if (sessionIndex === -1) {
        throw new Error('Coworking session not found');
      }

      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        ...updateData,
        updatedAt: new Date()
      };

      await fs.writeFile(this.coworkingSessionsFile, JSON.stringify(sessions, null, 2));
      return sessions[sessionIndex];
    } catch (error) {
      console.error('Error updating coworking session:', error);
      throw error;
    }
  }

  async deleteCoworkingSession(id) {
    try {
      const sessions = await this.getCoworkingSessions();
      const sessionIndex = sessions.findIndex(s => s._id === id);

      if (sessionIndex === -1) {
        throw new Error('Coworking session not found');
      }

      sessions.splice(sessionIndex, 1);
      await fs.writeFile(this.coworkingSessionsFile, JSON.stringify(sessions, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting coworking session:', error);
      throw error;
    }
  }

  // CUSTOMERS
  async getCustomers() {
    try {
      await this.initializeFile(this.customersFile, []);
      const data = await fs.readFile(this.customersFile, 'utf8');
      return JSON.parse(data).filter(c => c.isActive !== false);
    } catch (error) {
      console.error('Error reading customers:', error);
      return [];
    }
  }

  async getCustomerById(id) {
    try {
      const customers = await this.getCustomers();
      return customers.find(c => c._id === id);
    } catch (error) {
      console.error('Error getting customer by ID:', error);
      return null;
    }
  }

  async getCustomerByName(name) {
    try {
      const customers = await this.getCustomers();
      return customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    } catch (error) {
      console.error('Error getting customer by name:', error);
      return null;
    }
  }

  async createCustomer(customerData) {
    try {
      const customers = await this.getCustomers();
      
      const newCustomer = {
        _id: customerData._id || this.generateId(),
        name: customerData.name,
        email: customerData.email || null,
        phone: customerData.phone || null,
        birthDate: customerData.birthDate || null,
        notes: customerData.notes || '',
        status: customerData.status || 'active',
        tags: customerData.tags || [],
        preferredServices: customerData.preferredServices || [],
        totalVisits: customerData.totalVisits || 0,
        firstVisit: customerData.firstVisit || new Date().toISOString(),
        lastVisit: customerData.lastVisit || new Date().toISOString(),
        totalSpent: customerData.totalSpent || 0,
        averageSpent: customerData.averageSpent || 0,
        totalSessions: customerData.totalSessions || 0,
        totalHours: customerData.totalHours || 0,
        favoriteProducts: customerData.favoriteProducts || [],
        productStatistics: customerData.productStatistics || {},
        preferredPaymentMethod: customerData.preferredPaymentMethod || null,
        paymentStatistics: customerData.paymentStatistics || {
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0
        },
        averageSessionDuration: customerData.averageSessionDuration || 0,
        preferredTimeSlots: customerData.preferredTimeSlots || [],
        weekdayPreferences: customerData.weekdayPreferences || {},
        loyaltyPoints: customerData.loyaltyPoints || 0,
        loyaltyTier: customerData.loyaltyTier || 'bronze',
        isActive: customerData.isActive !== undefined ? customerData.isActive : true,
        createdBy: customerData.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      customers.push(newCustomer);
      await fs.writeFile(this.customersFile, JSON.stringify(customers, null, 2));
      
      return newCustomer;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  async updateCustomer(id, updateData) {
    try {
      const customers = await this.getCustomers();
      const customerIndex = customers.findIndex(c => c._id === id);

      if (customerIndex === -1) {
        throw new Error('Customer not found');
      }

      customers[customerIndex] = {
        ...customers[customerIndex],
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await fs.writeFile(this.customersFile, JSON.stringify(customers, null, 2));
      return customers[customerIndex];
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async deleteCustomer(id) {
    try {
      const customers = await this.getCustomers();
      const customerIndex = customers.findIndex(c => c._id === id);

      if (customerIndex === -1) {
        throw new Error('Customer not found');
      }

      // Soft delete
      customers[customerIndex].isActive = false;
      customers[customerIndex].updatedAt = new Date().toISOString();

      await fs.writeFile(this.customersFile, JSON.stringify(customers, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  async searchCustomers(query) {
    try {
      const customers = await this.getCustomers();
      const searchTerm = query.toLowerCase();
      
      return customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        (customer.email && customer.email.toLowerCase().includes(searchTerm)) ||
        (customer.phone && customer.phone.includes(searchTerm))
      );
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  }

  async getCustomerStats() {
    try {
      const customers = await this.getCustomers();
      
      const stats = {
        total: customers.length,
        active: customers.filter(c => c.status === 'active').length,
        vip: customers.filter(c => c.status === 'vip').length,
        totalLifetimeValue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
        averageLifetimeValue: 0,
        topSpenders: customers
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 10)
          .map(c => ({
            id: c._id,
            name: c.name,
            totalSpent: c.totalSpent,
            totalVisits: c.totalVisits,
            loyaltyTier: c.loyaltyTier
          })),
        segmentation: {
          new: customers.filter(c => c.totalVisits < 3).length,
          occasional: customers.filter(c => c.totalVisits >= 3 && c.totalVisits < 10).length,
          regular: customers.filter(c => c.totalVisits >= 10 && c.totalVisits < 20).length,
          loyal: customers.filter(c => c.totalVisits >= 20 && c.totalVisits < 50).length,
          vip: customers.filter(c => c.totalVisits >= 50 && c.totalSpent >= 5000).length
        },
        loyaltyTiers: {
          bronze: customers.filter(c => c.loyaltyTier === 'bronze').length,
          silver: customers.filter(c => c.loyaltyTier === 'silver').length,
          gold: customers.filter(c => c.loyaltyTier === 'gold').length,
          platinum: customers.filter(c => c.loyaltyTier === 'platinum').length
        },
        atRisk: customers.filter(c => {
          const daysSinceLastVisit = Math.ceil((new Date() - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24));
          return daysSinceLastVisit > 30;
        }).length
      };
      
      if (stats.total > 0) {
        stats.averageLifetimeValue = stats.totalLifetimeValue / stats.total;
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting customer stats:', error);
      return {
        total: 0,
        active: 0,
        vip: 0,
        totalLifetimeValue: 0,
        averageLifetimeValue: 0,
        topSpenders: [],
        segmentation: { new: 0, occasional: 0, regular: 0, loyal: 0, vip: 0 },
        loyaltyTiers: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
        atRisk: 0
      };
    }
  }

  // ============ EXPENSES MANAGEMENT ============

  async getExpenses() {
    try {
      const data = await fs.readFile(this.expensesFile, 'utf8');
      return JSON.parse(data).filter(expense => expense.isActive !== false);
    } catch (error) {
      console.error('Error reading expenses:', error);
      return [];
    }
  }

  async getExpenseById(id) {
    try {
      const expenses = await this.getExpenses();
      return expenses.find(e => e._id === id);
    } catch (error) {
      console.error('Error getting expense by id:', error);
      return null;
    }
  }

  async createExpense(expenseData) {
    try {
      const expenses = await this.getExpenses();
      
      const expense = {
        _id: this.generateId(),
        ...expenseData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };
      
      expenses.push(expense);
      await fs.writeFile(this.expensesFile, JSON.stringify(expenses, null, 2));
      
      console.log('💰 Created expense:', {
        id: expense._id,
        amount: expense.amount,
        category: expense.category,
        description: expense.description
      });
      
      return expense;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  async updateExpense(id, updateData) {
    try {
      const expenses = await this.getExpenses();
      const expenseIndex = expenses.findIndex(e => e._id === id);
      
      if (expenseIndex === -1) {
        throw new Error('Expense not found');
      }
      
      expenses[expenseIndex] = {
        ...expenses[expenseIndex],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeFile(this.expensesFile, JSON.stringify(expenses, null, 2));
      
      console.log('🔄 Updated expense:', {
        id: id,
        amount: expenses[expenseIndex].amount,
        category: expenses[expenseIndex].category
      });
      
      return expenses[expenseIndex];
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(id) {
    try {
      const expenses = await this.getExpenses();
      const expenseIndex = expenses.findIndex(e => e._id === id);
      
      if (expenseIndex === -1) {
        throw new Error('Expense not found');
      }
      
      // Soft delete
      expenses[expenseIndex].isActive = false;
      expenses[expenseIndex].updatedAt = new Date().toISOString();
      
      await fs.writeFile(this.expensesFile, JSON.stringify(expenses, null, 2));
      
      console.log('🗑️ Deleted expense:', id);
      
      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  async getExpensesByCategory(category) {
    try {
      const expenses = await this.getExpenses();
      return expenses.filter(expense => expense.category === category);
    } catch (error) {
      console.error('Error getting expenses by category:', error);
      return [];
    }
  }

  async getExpensesByDateRange(startDate, endDate) {
    try {
      const expenses = await this.getExpenses();
      return expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    } catch (error) {
      console.error('Error getting expenses by date range:', error);
      return [];
    }
  }

  async getRecurringExpenses() {
    try {
      const expenses = await this.getExpenses();
      return expenses.filter(expense => expense.type === 'recurrente');
    } catch (error) {
      console.error('Error getting recurring expenses:', error);
      return [];
    }
  }

  async getOverdueExpenses() {
    try {
      const expenses = await this.getExpenses();
      const today = new Date();
      
      return expenses.filter(expense => {
        if (expense.type !== 'recurrente' || expense.status === 'pagado') {
          return false;
        }
        
        if (!expense.nextDueDate) {
          return false;
        }
        
        return new Date(expense.nextDueDate) < today;
      });
    } catch (error) {
      console.error('Error getting overdue expenses:', error);
      return [];
    }
  }

  async getExpenseStats() {
    try {
      const expenses = await this.getExpenses();
      const Expense = require('../models/Expense');
      const categories = Expense.getCategories();
      
      // Current month calculations
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const currentMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startOfMonth && expenseDate <= endOfMonth;
      });
      
      // Previous month for comparison
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const prevMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startOfPrevMonth && expenseDate <= endOfPrevMonth;
      });
      
      // Calculate totals
      const totalThisMonth = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalLastMonth = prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      // Group by category
      const byCategory = {};
      Object.keys(categories).forEach(categoryId => {
        const categoryExpenses = currentMonthExpenses.filter(e => e.category === categoryId);
        byCategory[categoryId] = {
          name: categories[categoryId].name,
          total: categoryExpenses.reduce((sum, e) => sum + e.amount, 0),
          count: categoryExpenses.length,
          color: categories[categoryId].color,
          icon: categories[categoryId].icon
        };
      });
      
      // Calculate percentage change
      const percentageChange = totalLastMonth > 0 ? 
        ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : 
        (totalThisMonth > 0 ? 100 : 0);
      
      // Get overdue expenses
      const overdueExpenses = await this.getOverdueExpenses();
      const overdueAmount = overdueExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      return {
        currentMonth: {
          total: totalThisMonth,
          count: currentMonthExpenses.length,
          byCategory: byCategory
        },
        previousMonth: {
          total: totalLastMonth,
          count: prevMonthExpenses.length
        },
        comparison: {
          percentageChange: Math.round(percentageChange * 100) / 100,
          absoluteChange: totalThisMonth - totalLastMonth,
          trend: totalThisMonth > totalLastMonth ? 'up' : 
                totalThisMonth < totalLastMonth ? 'down' : 'stable'
        },
        overdue: {
          count: overdueExpenses.length,
          amount: overdueAmount
        },
        topCategories: Object.entries(byCategory)
          .sort(([,a], [,b]) => b.total - a.total)
          .slice(0, 5)
          .map(([id, data]) => ({ id, ...data })),
        recurringExpenses: (await this.getRecurringExpenses()).length
      };
    } catch (error) {
      console.error('Error getting expense stats:', error);
      return {
        currentMonth: { total: 0, count: 0, byCategory: {} },
        previousMonth: { total: 0, count: 0 },
        comparison: { percentageChange: 0, absoluteChange: 0, trend: 'stable' },
        overdue: { count: 0, amount: 0 },
        topCategories: [],
        recurringExpenses: 0
      };
    }
  }

}

// Export singleton instance
const fileDatabase = new FileDatabase();

module.exports = fileDatabase;