// CoworkingSession model for file-based storage
class CoworkingSession {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.clientName = data.clientName || '';
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.hourlyRate = data.hourlyRate || 25;
    this.totalCost = data.totalCost || 0;
    this.status = data.status || 'active'; // active, paused, completed
    this.notes = data.notes || '';
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

  // Convert to plain object for storage
  toJSON() {
    return {
      id: this.id,
      clientName: this.clientName,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      hourlyRate: this.hourlyRate,
      totalCost: this.totalCost,
      status: this.status,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = CoworkingSession;
