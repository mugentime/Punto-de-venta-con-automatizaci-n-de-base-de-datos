// Customer model for comprehensive client management
class Customer {
  constructor(data = {}) {
    this._id = data._id || data.id || this.generateId();
    this.id = this._id; // Compatibility
    
    // Basic Information
    this.name = data.name || '';
    this.email = data.email || null;
    this.phone = data.phone || null;
    this.birthDate = data.birthDate || null;
    this.notes = data.notes || '';
    
    // Status and Activity
    this.status = data.status || 'active'; // active, inactive, vip
    this.tags = data.tags || []; // Array of tags like ['frequent', 'coworking', 'morning']
    this.preferredServices = data.preferredServices || []; // ['coworking', 'cafeteria']
    
    // Visit Statistics
    this.totalVisits = data.totalVisits || 0;
    this.firstVisit = data.firstVisit || new Date().toISOString();
    this.lastVisit = data.lastVisit || new Date().toISOString();
    
    // Financial Statistics
    this.totalSpent = data.totalSpent || 0;
    this.averageSpent = data.averageSpent || 0;
    this.totalSessions = data.totalSessions || 0; // For coworking
    this.totalHours = data.totalHours || 0; // For coworking
    
    // Product Preferences
    this.favoriteProducts = data.favoriteProducts || []; // Array of {productId, name, count}
    this.productStatistics = data.productStatistics || {}; // {productId: {quantity, totalSpent}}
    
    // Payment Preferences
    this.preferredPaymentMethod = data.preferredPaymentMethod || null;
    this.paymentStatistics = data.paymentStatistics || {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0
    };
    
    // Behavioral Analysis
    this.averageSessionDuration = data.averageSessionDuration || 0; // In minutes
    this.preferredTimeSlots = data.preferredTimeSlots || []; // ['morning', 'afternoon', 'evening']
    this.weekdayPreferences = data.weekdayPreferences || {}; // {Monday: 5, Tuesday: 3, etc.}
    
    // Loyalty Program
    this.loyaltyPoints = data.loyaltyPoints || 0;
    this.loyaltyTier = data.loyaltyTier || 'bronze'; // bronze, silver, gold, platinum
    
    // Membership Information
    this.membershipStatus = data.membershipStatus || 'none'; // none, active, expired
    this.membershipType = data.membershipType || null; // monthly, annual
    this.membershipStartDate = data.membershipStartDate || null;
    this.membershipEndDate = data.membershipEndDate || null;
    this.membershipPrice = data.membershipPrice || 0;
    this.membershipBenefitsUsed = data.membershipBenefitsUsed || 0; // Hours used with membership
    this.hasPaidMembership = data.hasPaidMembership || false;
    
    // System fields
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    return 'customer_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Update customer with a new visit/record
  addVisit(recordData) {
    this.totalVisits += 1;
    this.lastVisit = recordData.date || new Date().toISOString();
    this.totalSpent += recordData.total || 0;
    
    // Update averages
    this.averageSpent = this.totalSpent / this.totalVisits;
    
    // Update service preferences
    if (recordData.service && !this.preferredServices.includes(recordData.service)) {
      this.preferredServices.push(recordData.service);
    }
    
    // Update payment statistics
    if (recordData.payment && this.paymentStatistics.hasOwnProperty(recordData.payment)) {
      this.paymentStatistics[recordData.payment] += 1;
    }
    
    // Update product statistics
    if (recordData.products && Array.isArray(recordData.products)) {
      recordData.products.forEach(product => {
        const productId = product.productId || product._id;
        if (!this.productStatistics[productId]) {
          this.productStatistics[productId] = {
            name: product.name,
            quantity: 0,
            totalSpent: 0,
            category: product.category
          };
        }
        
        this.productStatistics[productId].quantity += product.quantity || 1;
        this.productStatistics[productId].totalSpent += (product.price || 0) * (product.quantity || 1);
      });
    }
    
    // Update coworking-specific data
    if (recordData.service === 'coworking') {
      this.totalSessions += 1;
      this.totalHours += recordData.hours || 0;
      
      if (this.totalSessions > 0) {
        this.averageSessionDuration = (this.totalHours * 60) / this.totalSessions; // Convert to minutes
      }
    }
    
    // Update behavioral patterns
    this.updateBehavioralPatterns(recordData);
    
    // Update loyalty points (1 point per peso spent)
    this.loyaltyPoints += Math.floor(recordData.total || 0);
    this.updateLoyaltyTier();
    
    this.updatedAt = new Date().toISOString();
    return this;
  }
  
  // Update behavioral patterns
  updateBehavioralPatterns(recordData) {
    const visitDate = new Date(recordData.date || Date.now());
    
    // Time slot preferences
    const hour = visitDate.getHours();
    let timeSlot;
    if (hour < 12) timeSlot = 'morning';
    else if (hour < 18) timeSlot = 'afternoon';
    else timeSlot = 'evening';
    
    if (!this.preferredTimeSlots.includes(timeSlot)) {
      this.preferredTimeSlots.push(timeSlot);
    }
    
    // Weekday preferences
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = weekdays[visitDate.getDay()];
    
    this.weekdayPreferences[weekday] = (this.weekdayPreferences[weekday] || 0) + 1;
  }
  
  // Update loyalty tier based on points
  updateLoyaltyTier() {
    if (this.loyaltyPoints >= 10000) {
      this.loyaltyTier = 'platinum';
    } else if (this.loyaltyPoints >= 5000) {
      this.loyaltyTier = 'gold';
    } else if (this.loyaltyPoints >= 2000) {
      this.loyaltyTier = 'silver';
    } else {
      this.loyaltyTier = 'bronze';
    }
  }
  
  // Get top favorite products
  getFavoriteProducts(limit = 5) {
    const productArray = Object.entries(this.productStatistics)
      .map(([productId, stats]) => ({
        productId,
        ...stats
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
    
    return productArray;
  }
  
  // Get preferred payment method
  getPreferredPaymentMethod() {
    const payments = this.paymentStatistics;
    return Object.keys(payments).reduce((a, b) => payments[a] > payments[b] ? a : b);
  }
  
  // Calculate customer lifetime value
  getLifetimeValue() {
    return this.totalSpent;
  }
  
  // Get customer tier color for UI
  getTierColor() {
    const colors = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
      platinum: '#e5e4e2'
    };
    return colors[this.loyaltyTier] || colors.bronze;
  }
  
  // Calculate days since last visit
  getDaysSinceLastVisit() {
    const now = new Date();
    const lastVisit = new Date(this.lastVisit);
    const diffTime = Math.abs(now - lastVisit);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  // Determine if customer is at risk (hasn't visited in a while)
  isAtRisk() {
    return this.getDaysSinceLastVisit() > 30; // 30 days without visit
  }
  
  // Get customer segment
  getSegment() {
    // VIP status for active memberships
    if (this.hasActiveMembership()) {
      return 'vip';
    }
    
    if (this.totalVisits >= 50 && this.totalSpent >= 5000) {
      return 'vip';
    } else if (this.totalVisits >= 20 && this.totalSpent >= 2000) {
      return 'loyal';
    } else if (this.totalVisits >= 10) {
      return 'regular';
    } else if (this.totalVisits >= 3) {
      return 'occasional';
    } else {
      return 'new';
    }
  }
  
  // Check if customer has active membership
  hasActiveMembership() {
    if (this.membershipStatus !== 'active') return false;
    if (!this.membershipEndDate) return false;
    
    const now = new Date();
    const endDate = new Date(this.membershipEndDate);
    return now <= endDate;
  }
  
  // Activate membership
  activateMembership(type = 'monthly', price = 1800) {
    const now = new Date();
    const endDate = new Date();
    
    if (type === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (type === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    this.membershipStatus = 'active';
    this.membershipType = type;
    this.membershipStartDate = now.toISOString();
    this.membershipEndDate = endDate.toISOString();
    this.membershipPrice = price;
    this.membershipBenefitsUsed = 0;
    this.hasPaidMembership = true;
    
    // Add to total spent
    this.totalSpent += price;
    this.totalVisits += 1;
    
    // Update loyalty points
    this.loyaltyPoints += Math.floor(price);
    this.updateLoyaltyTier();
    
    this.updatedAt = new Date().toISOString();
    return this;
  }
  
  // Check if membership is about to expire (within 7 days)
  isMembershipExpiringSoon() {
    if (!this.hasActiveMembership()) return false;
    
    const now = new Date();
    const endDate = new Date(this.membershipEndDate);
    const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    return daysUntilExpiry <= 7;
  }
  
  // Get membership savings (how much saved compared to hourly rates)
  getMembershipSavings() {
    if (!this.hasPaidMembership) return 0;
    
    // Estimate savings based on usage
    const hoursUsedWithMembership = this.membershipBenefitsUsed;
    const wouldHavePaid = hoursUsedWithMembership * 58; // Standard hourly rate
    return Math.max(0, wouldHavePaid - this.membershipPrice);
  }
  
  // Use membership benefits (track hours used)
  useMembershipBenefits(hours) {
    if (this.hasActiveMembership()) {
      this.membershipBenefitsUsed += hours;
      this.updatedAt = new Date().toISOString();
    }
    return this;
  }
  
  // Validate customer data
  validate() {
    const errors = [];
    
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Customer name is required');
    }
    
    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Invalid email format');
    }
    
    if (this.phone && !this.isValidPhone(this.phone)) {
      errors.push('Invalid phone format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  isValidPhone(phone) {
    // Mexican phone number format
    const phoneRegex = /^(\+52)?[\s\-]?(\d{2,3})[\s\-]?(\d{3,4})[\s\-]?(\d{4})$/;
    return phoneRegex.test(phone);
  }
  
  // Convert to JSON for storage
  toJSON() {
    return {
      _id: this._id,
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      birthDate: this.birthDate,
      notes: this.notes,
      status: this.status,
      tags: this.tags,
      preferredServices: this.preferredServices,
      totalVisits: this.totalVisits,
      firstVisit: this.firstVisit,
      lastVisit: this.lastVisit,
      totalSpent: this.totalSpent,
      averageSpent: this.averageSpent,
      totalSessions: this.totalSessions,
      totalHours: this.totalHours,
      favoriteProducts: this.favoriteProducts,
      productStatistics: this.productStatistics,
      preferredPaymentMethod: this.preferredPaymentMethod,
      paymentStatistics: this.paymentStatistics,
      averageSessionDuration: this.averageSessionDuration,
      preferredTimeSlots: this.preferredTimeSlots,
      weekdayPreferences: this.weekdayPreferences,
      loyaltyPoints: this.loyaltyPoints,
      loyaltyTier: this.loyaltyTier,
      membershipStatus: this.membershipStatus,
      membershipType: this.membershipType,
      membershipStartDate: this.membershipStartDate,
      membershipEndDate: this.membershipEndDate,
      membershipPrice: this.membershipPrice,
      membershipBenefitsUsed: this.membershipBenefitsUsed,
      hasPaidMembership: this.hasPaidMembership,
      isActive: this.isActive,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
  
  // Create summary for display
  getSummary() {
    return {
      id: this._id,
      name: this.name,
      segment: this.getSegment(),
      totalVisits: this.totalVisits,
      totalSpent: this.totalSpent,
      averageSpent: this.averageSpent,
      lastVisit: this.lastVisit,
      loyaltyTier: this.loyaltyTier,
      loyaltyPoints: this.loyaltyPoints,
      favoriteProducts: this.getFavoriteProducts(3),
      preferredPayment: this.getPreferredPaymentMethod(),
      isAtRisk: this.isAtRisk(),
      daysSinceLastVisit: this.getDaysSinceLastVisit()
    };
  }
}

module.exports = Customer;
