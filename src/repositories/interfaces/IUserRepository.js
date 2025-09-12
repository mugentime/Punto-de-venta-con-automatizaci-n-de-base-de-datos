/**
 * User Repository Interface
 * Defines the contract for user data access operations
 */
class IUserRepository {
    async findById(id) {
        throw new Error('Method not implemented');
    }

    async findByEmail(email) {
        throw new Error('Method not implemented');
    }

    async findAll(filters = {}) {
        throw new Error('Method not implemented');
    }

    async create(userData) {
        throw new Error('Method not implemented');
    }

    async update(id, userData) {
        throw new Error('Method not implemented');
    }

    async delete(id) {
        throw new Error('Method not implemented');
    }

    async exists(email) {
        throw new Error('Method not implemented');
    }

    async count(filters = {}) {
        throw new Error('Method not implemented');
    }
}

module.exports = IUserRepository;