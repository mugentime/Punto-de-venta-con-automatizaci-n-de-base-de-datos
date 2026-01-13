// CoworkingSession model for file-based storage
class CoworkingSession {
  constructor(data = {}) {
    this._id = data._id || data.id || this.generateId();
    this.id = this._id; // Compatibility
    this.client = data.client || data.clientName || '';
    this.clientName = this.client; // Compatibility
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.hourlyRate = data.hourlyRate || 72; // Updated default rate
    this.totalCost = data.totalCost || 0;
    this.status = data.status || 'active'; // active, paused, completed, closed
    this.notes = data.notes || '';
    this.products = data.products || []; // Products added to session
    this.subtotal = data.subtotal || 0;
    this.timeCharge = data.timeCharge || 0;
    this.total = data.total || 0;
    this.cost = data.cost || 0;
    this.profit = data.profit || 0;
    this.payment = data.payment || null;
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    return 'session_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Calculate total cost based on duration and hourly rate
  calculateCost() {
    const hours = this.duration / 3600000; // Convert milliseconds to hours
    this.totalCost = Math.round(hours * this.hourlyRate * 100) / 100;
    return this.totalCost;
  }

  // Update session duration
  updateDuration() {
    if (this.startTime && this.endTime) {
      this.duration = new Date(this.endTime).getTime() - new Date(this.startTime).getTime();
    } else if (this.startTime && this.status === 'active') {
      this.duration = new Date().getTime() - new Date(this.startTime).getTime();
    }
    this.calculateCost();
    this.updatedAt = new Date().toISOString();
  }

  // End the session
  end() {
    this.endTime = new Date().toISOString();
    this.status = 'completed';
    this.updateDuration();
  }

  // Pause the session
  pause() {
    this.status = 'paused';
    this.updatedAt = new Date().toISOString();
  }

  // Resume the session
  resume() {
    this.status = 'active';
    this.updatedAt = new Date().toISOString();
  }

  // Calculate comprehensive totals (for compatibility with routes)
  calculateTotals() {
    this.updateDuration();
    
    // Calculate time charge with day rate logic
    const hours = this.duration / 3600000;
    
    // Apply day rate if session exceeds 4 hours
    if (hours > 4) {
      this.timeCharge = 225; // Day rate
      this.appliedRate = 'day';
      this.rateReason = 'Session exceeded 4 hours, day rate applied';
    } else {
      this.timeCharge = hours * this.hourlyRate;
      this.appliedRate = 'hourly';
      this.rateReason = 'Standard hourly rate';
    }
    
    // Note: If customer has active membership, this charge will be waived at checkout
    // The membership check is done at the customer level during record creation
    
    // Calculate products subtotal
    this.subtotal = this.products.reduce((sum, product) => {
      // Only charge refrigerator products in coworking sessions
      if (product.category === 'refrigerador') {
        return sum + (product.price * product.quantity);
      }
      return sum;
    }, 0);
    
    // Calculate product costs
    this.cost = this.products.reduce((sum, product) => {
      return sum + (product.cost * product.quantity);
    }, 0);
    
    // Total = subtotal (refrigerador) + time charge
    this.total = this.subtotal + this.timeCharge;
    this.totalCost = this.total; // Compatibility
    
    // Calculate profit
    this.profit = this.total - this.cost;
    
    this.updatedAt = new Date().toISOString();
    return this;
  }
  
  // Get elapsed hours
  getElapsedHours() {
    if (this.status === 'active') {
      this.updateDuration();
    }
    return this.duration / 3600000;
  }
  
  // Get formatted duration string
  getFormattedDuration() {
    const totalMinutes = Math.floor(this.duration / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  
  // Add product to session
  addProduct(productData) {
    const existingProductIndex = this.products.findIndex(p => p.productId === productData.productId);
    
    if (existingProductIndex >= 0) {
      this.products[existingProductIndex].quantity += productData.quantity;
    } else {
      this.products.push({
        productId: productData.productId,
        name: productData.name,
        quantity: productData.quantity,
        price: productData.price,
        cost: productData.cost,
        category: productData.category
      });
    }
    
    this.calculateTotals();
    return this;
  }
  
  // Remove product from session
  removeProduct(productId, quantityToRemove = null) {
    const productIndex = this.products.findIndex(p => p.productId === productId);
    
    if (productIndex >= 0) {
      if (quantityToRemove && quantityToRemove < this.products[productIndex].quantity) {
        this.products[productIndex].quantity -= quantityToRemove;
      } else {
        this.products.splice(productIndex, 1);
      }
    }
    
    this.calculateTotals();
    return this;
  }
  
  // Close session
  closeSession(paymentMethod = null) {
    this.endTime = new Date().toISOString();
    this.status = 'closed';
    this.payment = paymentMethod;
    this.calculateTotals();
    return this;
  }
  
  // Cancel session
  cancelSession() {
    this.status = 'cancelled';
    this.endTime = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    return this;
  }
  
  // Validate session data
  validate() {
    const errors = [];
    
    if (!this.client || this.client.trim().length === 0) {
      errors.push('Client name is required');
    }
    
    if (this.hourlyRate <= 0) {
      errors.push('Hourly rate must be greater than 0');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Convert to plain object for storage
  toJSON() {
    return {
      _id: this._id,
      id: this.id,
      client: this.client,
      clientName: this.client, // Compatibility
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      hourlyRate: this.hourlyRate,
      totalCost: this.totalCost,
      status: this.status,
      notes: this.notes,
      products: this.products,
      subtotal: this.subtotal,
      timeCharge: this.timeCharge,
      total: this.total,
      cost: this.cost,
      profit: this.profit,
      payment: this.payment,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = CoworkingSession;
