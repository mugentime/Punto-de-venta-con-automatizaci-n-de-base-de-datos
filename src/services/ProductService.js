/**
 * Product Service
 * Handles all product-related business logic
 */
class ProductService {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    /**
     * Get all products with filtering and pagination
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Products with metadata
     */
    async getProducts(filters = {}) {
        try {
            const { 
                category, 
                active = true, 
                lowStock = false,
                search,
                page = 1, 
                limit = 50,
                sortBy = 'name',
                sortOrder = 'asc'
            } = filters;

            const searchFilters = {
                category,
                active,
                search,
                page: parseInt(page),
                limit: parseInt(limit),
                sortBy,
                sortOrder
            };

            const products = await this.productRepository.findAll(searchFilters);
            const totalCount = await this.productRepository.count(searchFilters);

            // Filter for low stock if requested
            let filteredProducts = products;
            if (lowStock) {
                filteredProducts = products.filter(product => 
                    product.quantity <= (product.lowStockAlert || 5)
                );
            }

            return {
                success: true,
                products: filteredProducts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get product by ID
     * @param {string} id - Product ID
     * @returns {Promise<Object>} Product result
     */
    async getProductById(id) {
        try {
            if (!id) {
                throw new Error('Product ID is required');
            }

            const product = await this.productRepository.findById(id);
            if (!product) {
                throw new Error('Product not found');
            }

            return {
                success: true,
                product
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create new product
     * @param {Object} productData - Product data
     * @param {string} createdBy - User ID who created the product
     * @returns {Promise<Object>} Creation result
     */
    async createProduct(productData, createdBy) {
        try {
            const {
                name,
                category,
                quantity = 0,
                cost,
                price,
                lowStockAlert = 5,
                description = '',
                barcode = ''
            } = productData;

            // Validate required fields
            if (!name || !category || cost === undefined || price === undefined) {
                throw new Error('Name, category, cost, and price are required');
            }

            // Validate numeric fields
            if (cost < 0 || price < 0 || quantity < 0) {
                throw new Error('Cost, price, and quantity must be non-negative');
            }

            if (price < cost) {
                console.warn(`Product "${name}" has price (${price}) lower than cost (${cost})`);
            }

            // Check if product with same name and category already exists
            const existingProduct = await this.productRepository.findByNameAndCategory(name, category);
            if (existingProduct) {
                throw new Error(`Product "${name}" already exists in category "${category}"`);
            }

            const newProduct = await this.productRepository.create({
                name: name.trim(),
                category: category.toLowerCase(),
                quantity: parseInt(quantity),
                cost: parseFloat(cost),
                price: parseFloat(price),
                lowStockAlert: parseInt(lowStockAlert),
                description: description.trim(),
                barcode: barcode.trim(),
                createdBy
            });

            return {
                success: true,
                product: newProduct,
                message: 'Product created successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update product
     * @param {string} id - Product ID
     * @param {Object} updateData - Update data
     * @param {string} updatedBy - User ID who updated the product
     * @returns {Promise<Object>} Update result
     */
    async updateProduct(id, updateData, updatedBy) {
        try {
            if (!id) {
                throw new Error('Product ID is required');
            }

            // Get existing product
            const existingProduct = await this.productRepository.findById(id);
            if (!existingProduct) {
                throw new Error('Product not found');
            }

            // Validate update data
            const allowedFields = ['name', 'category', 'quantity', 'cost', 'price', 'lowStockAlert', 'description', 'barcode', 'isActive'];
            const filteredUpdateData = {};

            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredUpdateData[key] = updateData[key];
                }
            });

            // Validate numeric fields if provided
            if (filteredUpdateData.cost !== undefined && filteredUpdateData.cost < 0) {
                throw new Error('Cost must be non-negative');
            }
            if (filteredUpdateData.price !== undefined && filteredUpdateData.price < 0) {
                throw new Error('Price must be non-negative');
            }
            if (filteredUpdateData.quantity !== undefined && filteredUpdateData.quantity < 0) {
                throw new Error('Quantity must be non-negative');
            }

            // Parse numeric fields
            if (filteredUpdateData.quantity !== undefined) {
                filteredUpdateData.quantity = parseInt(filteredUpdateData.quantity);
            }
            if (filteredUpdateData.cost !== undefined) {
                filteredUpdateData.cost = parseFloat(filteredUpdateData.cost);
            }
            if (filteredUpdateData.price !== undefined) {
                filteredUpdateData.price = parseFloat(filteredUpdateData.price);
            }

            // Add metadata
            filteredUpdateData.updatedBy = updatedBy;

            const updatedProduct = await this.productRepository.update(id, filteredUpdateData);

            return {
                success: true,
                product: updatedProduct,
                message: 'Product updated successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete product (soft delete)
     * @param {string} id - Product ID
     * @param {string} deletedBy - User ID who deleted the product
     * @returns {Promise<Object>} Deletion result
     */
    async deleteProduct(id, deletedBy) {
        try {
            if (!id) {
                throw new Error('Product ID is required');
            }

            const result = await this.productRepository.delete(id, deletedBy);
            if (!result) {
                throw new Error('Product not found or already inactive');
            }

            return {
                success: true,
                message: 'Product deleted successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update product stock
     * @param {string} id - Product ID
     * @param {number} quantityChange - Quantity change (positive for increase, negative for decrease)
     * @param {string} reason - Reason for stock change
     * @param {string} updatedBy - User ID who updated the stock
     * @returns {Promise<Object>} Stock update result
     */
    async updateStock(id, quantityChange, reason, updatedBy) {
        try {
            if (!id) {
                throw new Error('Product ID is required');
            }

            if (quantityChange === 0) {
                throw new Error('Quantity change cannot be zero');
            }

            const product = await this.productRepository.findById(id);
            if (!product) {
                throw new Error('Product not found');
            }

            const newQuantity = product.quantity + quantityChange;
            if (newQuantity < 0) {
                throw new Error('Insufficient stock. Current quantity: ' + product.quantity);
            }

            const updatedProduct = await this.productRepository.update(id, {
                quantity: newQuantity,
                updatedBy
            });

            // Log stock change (in a real system, you'd have a separate audit log)
            console.log(`Stock updated for ${product.name}: ${product.quantity} -> ${newQuantity} (${quantityChange > 0 ? '+' : ''}${quantityChange}). Reason: ${reason}`);

            return {
                success: true,
                product: updatedProduct,
                message: `Stock updated successfully. New quantity: ${newQuantity}`,
                stockChange: {
                    previousQuantity: product.quantity,
                    newQuantity,
                    change: quantityChange,
                    reason
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get low stock products
     * @returns {Promise<Object>} Low stock products
     */
    async getLowStockProducts() {
        try {
            const allProducts = await this.productRepository.findAll({ active: true });
            const lowStockProducts = allProducts.filter(product => 
                product.quantity <= (product.lowStockAlert || 5)
            );

            return {
                success: true,
                products: lowStockProducts,
                count: lowStockProducts.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get product categories
     * @returns {Promise<Object>} Product categories with counts
     */
    async getCategories() {
        try {
            const products = await this.productRepository.findAll({ active: true });
            const categories = {};

            products.forEach(product => {
                const category = product.category;
                if (categories[category]) {
                    categories[category]++;
                } else {
                    categories[category] = 1;
                }
            });

            return {
                success: true,
                categories: Object.keys(categories).map(name => ({
                    name,
                    count: categories[name]
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate product data
     * @private
     */
    _validateProductData(data) {
        const errors = [];

        if (!data.name || data.name.trim().length === 0) {
            errors.push('Product name is required');
        }

        if (!data.category || data.category.trim().length === 0) {
            errors.push('Product category is required');
        }

        if (data.cost === undefined || data.cost === null || isNaN(data.cost)) {
            errors.push('Valid cost is required');
        }

        if (data.price === undefined || data.price === null || isNaN(data.price)) {
            errors.push('Valid price is required');
        }

        return errors;
    }
}

module.exports = ProductService;