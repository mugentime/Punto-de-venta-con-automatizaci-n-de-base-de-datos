const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
require('dotenv').config();

// Sample data for initial setup
const sampleProducts = [
  // Cafetería products
  {
    name: 'Espresso',
    category: 'cafeteria',
    quantity: 50,
    cost: 10,
    price: 35,
    lowStockAlert: 10,
    description: 'Café espresso tradicional'
  },
  {
    name: 'Americano',
    category: 'cafeteria',
    quantity: 45,
    cost: 12,
    price: 40,
    lowStockAlert: 10,
    description: 'Café americano suave'
  },
  {
    name: 'Capuccino',
    category: 'cafeteria',
    quantity: 40,
    cost: 15,
    price: 45,
    lowStockAlert: 10,
    description: 'Capuccino cremoso'
  },
  {
    name: 'Latte',
    category: 'cafeteria',
    quantity: 35,
    cost: 12,
    price: 40,
    lowStockAlert: 10,
    description: 'Latte con leche vaporizada'
  },
  {
    name: 'Mocha',
    category: 'cafeteria',
    quantity: 30,
    cost: 18,
    price: 50,
    lowStockAlert: 10,
    description: 'Café mocha con chocolate'
  },
  {
    name: 'Frappé de Café',
    category: 'cafeteria',
    quantity: 25,
    cost: 20,
    price: 55,
    lowStockAlert: 5,
    description: 'Frappé frío de café'
  },
  
  // Refrigerador products
  {
    name: 'Coca-Cola',
    category: 'refrigerador',
    quantity: 24,
    cost: 15,
    price: 25,
    lowStockAlert: 6,
    description: 'Refresco de cola 355ml'
  },
  {
    name: 'Agua Mineral',
    category: 'refrigerador',
    quantity: 30,
    cost: 8,
    price: 15,
    lowStockAlert: 10,
    description: 'Agua mineral 500ml'
  },
  {
    name: 'Jugo de Naranja',
    category: 'refrigerador',
    quantity: 15,
    cost: 20,
    price: 35,
    lowStockAlert: 5,
    description: 'Jugo de naranja natural 500ml'
  },
  {
    name: 'Sprite',
    category: 'refrigerador',
    quantity: 20,
    cost: 15,
    price: 25,
    lowStockAlert: 6,
    description: 'Refresco de limón 355ml'
  },
  {
    name: 'Red Bull',
    category: 'refrigerador',
    quantity: 12,
    cost: 25,
    price: 45,
    lowStockAlert: 3,
    description: 'Bebida energizante 250ml'
  },
  {
    name: 'Té Helado',
    category: 'refrigerador',
    quantity: 18,
    cost: 18,
    price: 30,
    lowStockAlert: 5,
    description: 'Té helado sabor limón 500ml'
  }
];

class SetupService {
  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/conejo-negro-pos');
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async createAdminUser() {
    try {
      // Check if admin already exists
      const adminExists = await User.findOne({ role: 'admin' });
      if (adminExists) {
        console.log('ℹ️ Admin user already exists');
        return adminExists;
      }

      // Create default admin user
      const admin = new User({
        name: 'Administrador',
        email: 'admin@conejonegro.com',
        password: 'admin123', // Change this in production!
        role: 'admin'
      });

      await admin.save();
      console.log('✅ Admin user created successfully');
      console.log('📧 Email: admin@conejonegro.com');
      console.log('🔑 Password: admin123');
      console.log('⚠️ Please change the admin password after first login!');
      
      return admin;
    } catch (error) {
      console.error('❌ Error creating admin user:', error);
      throw error;
    }
  }

  async createSampleProducts(adminUser) {
    try {
      // Check if products already exist
      const existingProducts = await Product.countDocuments();
      if (existingProducts > 0) {
        console.log(`ℹ️ ${existingProducts} products already exist`);
        return;
      }

      // Create sample products
      const products = sampleProducts.map(product => ({
        ...product,
        createdBy: adminUser._id
      }));

      await Product.insertMany(products);
      console.log(`✅ Created ${products.length} sample products`);
      
      // Show breakdown
      const cafeteriaCount = products.filter(p => p.category === 'cafeteria').length;
      const refrigeradorCount = products.filter(p => p.category === 'refrigerador').length;
      console.log(`   📚 ${cafeteriaCount} cafetería products`);
      console.log(`   🧊 ${refrigeradorCount} refrigerador products`);
      
    } catch (error) {
      console.error('❌ Error creating sample products:', error);
      throw error;
    }
  }

  async setupDatabase() {
    try {
      console.log('🔄 Setting up database...');
      
      // Create admin user
      const admin = await this.createAdminUser();
      
      // Create sample products
      await this.createSampleProducts(admin);
      
      console.log('✅ Database setup completed successfully!');
      
      return {
        success: true,
        adminUser: admin.toSafeObject(),
        productsCount: sampleProducts.length
      };
      
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      throw error;
    }
  }

  async checkEnvironment() {
    console.log('🔍 Checking environment variables...');
    
    const requiredEnvVars = [
      'MONGODB_URI',
      'JWT_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN'
    ];
    
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.log('⚠️ Missing environment variables:');
      missing.forEach(varName => console.log(`   - ${varName}`));
      console.log('📝 Please check your .env file');
      return false;
    }
    
    console.log('✅ All required environment variables are set');
    return true;
  }

  async displaySystemInfo() {
    try {
      const [
        userCount,
        productCount,
        adminUsers,
        cafeteriaProducts,
        refrigeradorProducts
      ] = await Promise.all([
        User.countDocuments(),
        Product.countDocuments(),
        User.countDocuments({ role: 'admin' }),
        Product.countDocuments({ category: 'cafeteria', isActive: true }),
        Product.countDocuments({ category: 'refrigerador', isActive: true })
      ]);

      console.log('\n📊 System Overview:');
      console.log(`   👥 Users: ${userCount} (${adminUsers} admins)`);
      console.log(`   📦 Products: ${productCount} total`);
      console.log(`   ☕ Cafetería: ${cafeteriaProducts} products`);
      console.log(`   🧊 Refrigerador: ${refrigeradorProducts} products`);
      console.log('\n🚀 System is ready to use!');
      console.log('🌐 Access your POS system at: http://localhost:3000');
      console.log('🌐 Online version: http://localhost:3000/online');
      
    } catch (error) {
      console.error('❌ Error displaying system info:', error);
    }
  }
}

// Main setup function
async function main() {
  const setup = new SetupService();
  
  try {
    console.log('🏪 Conejo Negro POS Setup');
    console.log('=========================\n');
    
    // Check environment
    const envOk = await setup.checkEnvironment();
    if (!envOk) {
      process.exit(1);
    }
    
    // Connect to database
    await setup.connect();
    
    // Setup database
    const result = await setup.setupDatabase();
    
    // Display system info
    await setup.displaySystemInfo();
    
    console.log('\n✨ Setup completed successfully!');
    console.log('💡 Run "npm start" to start the server');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📊 Database connection closed');
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = SetupService;