import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import ProductModal from '../components/ProductModal';
import ImportProductsModal from '../components/ImportProductsModal';
import { PlusIcon, EditIcon, TrashIcon, UploadIcon } from '../components/Icons';
import type { Product } from '../types';

const ProductsScreen: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState<{ [key: string]: number }>({});
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  const openModal = (product: Product | null = null) => {
    setProductToEdit(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setProductToEdit(null);
    setIsModalOpen(false);
  };

  const handleSave = (productData: Omit<Product, 'id'> | Product) => {
    if ('id' in productData) {
      updateProduct(productData as Product);
    } else {
      addProduct(productData);
    }
  };

  const handleDelete = (productId: string) => {
    if (window.innerWidth < 768) {
      // Mobile: Use confirmation state
      if (deleteConfirm === productId) {
        deleteProduct(productId);
        setDeleteConfirm(null);
        setSwipeX({});
      } else {
        setDeleteConfirm(productId);
        setTimeout(() => setDeleteConfirm(null), 3000);
      }
    } else {
      // Desktop: Direct confirmation
      if (window.confirm('¿Está seguro de eliminar este producto?')) {
        deleteProduct(productId);
      }
    }
  };

  // Touch handlers for swipe to delete (mobile)
  const handleTouchStart = (e: React.TouchEvent, productId: string) => {
    if (window.innerWidth >= 768) return;
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, productId: string) => {
    if (window.innerWidth >= 768) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    if (diff < -50 && diff > -150) {
      setSwipeX({ [productId]: diff });
    }
  };

  const handleTouchEnd = (productId: string) => {
    if (window.innerWidth >= 768) return;
    const diff = touchCurrentX.current - touchStartX.current;
    if (diff < -100) {
      setSwipeX({ [productId]: -120 });
    } else {
      setSwipeX({});
    }
  };

  // Group products by category
  const categories = [
    { name: 'Todos', key: 'all', icon: '📦', color: 'from-slate-50 to-gray-50' },
    { name: 'Cafetería', key: 'Cafetería', icon: '☕', color: 'from-amber-50 to-orange-50' },
    { name: 'Refrigerador', key: 'Refrigerador', icon: '🧊', color: 'from-blue-50 to-cyan-50' },
    { name: 'Alimentos', key: 'Alimentos', icon: '🍞', color: 'from-green-50 to-emerald-50' },
    { name: 'Membresías', key: 'Membresías', icon: '💼', color: 'from-purple-50 to-violet-50' },
  ];

  // Filter products by search and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedProducts = categories
    .filter(cat => cat.key === 'all' || selectedCategory === 'all' || cat.key === selectedCategory)
    .map(category => ({
      ...category,
      products: category.key === 'all'
        ? filteredProducts
        : filteredProducts.filter(p => p.category === category.key)
    }));

  return (
    <div className="pb-20 md:pb-4">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:justify-between md:items-center md:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Productos</h1>

        {/* Action Buttons - Mobile: Full width, Desktop: Inline */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
          {/* Mobile: Search Toggle */}
          <button
            onClick={() => setIsSearchVisible(!isSearchVisible)}
            className="md:hidden flex items-center justify-center px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center px-4 py-3 md:py-2 bg-white border border-slate-300 text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 transition-colors touch-manipulation"
          >
            <UploadIcon className="h-5 w-5 mr-2" />
            <span className="md:inline">Importar</span>
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center px-4 py-3 md:py-2 bg-zinc-900 text-white rounded-xl shadow-sm hover:bg-zinc-800 transition-colors touch-manipulation"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            <span className="md:inline">Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Search Bar - Collapsible on Mobile, Always Visible on Desktop */}
      <div className={`${isSearchVisible ? 'block' : 'hidden'} md:block mb-4 transition-all duration-300`}>
        <div className="relative">
          <input
            type="search"
            inputMode="search"
            placeholder="Buscar productos por nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-11 pr-4 text-base border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full touch-manipulation"
            >
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Category Selector - Dropdown on Mobile, Tabs on Tablet+ */}
      <div className="mb-6">
        {/* Mobile: Dropdown */}
        <div className="md:hidden">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation bg-white"
          >
            {categories.map(cat => (
              <option key={cat.key} value={cat.key}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tablet+: Horizontal Tabs */}
        <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`flex items-center px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.key
                  ? 'bg-zinc-900 text-white shadow-md'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl mr-2">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Display */}
      <div className="space-y-6">
        {groupedProducts.map(category => {
          if (category.key !== 'all' && category.products.length === 0) return null;

          return (
            <div key={category.key}>
              {/* Category Header - Skip for "all" filter */}
              {selectedCategory !== 'all' && (
                <div className={`bg-gradient-to-r ${category.color} rounded-2xl p-4 mb-4 border border-slate-200`}>
                  <div className="flex items-center">
                    <span className="text-3xl mr-3">{category.icon}</span>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">{category.name}</h2>
                      <p className="text-sm text-slate-600">{category.products.length} producto{category.products.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              )}

              {category.products.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border-2 border-dashed border-slate-200">
                  <p className="text-base">No hay productos {selectedCategory !== 'all' ? 'en esta categoría' : 'disponibles'}</p>
                  {searchQuery && <p className="text-sm mt-2">Intenta con otra búsqueda</p>}
                </div>
              ) : (
                <>
                  {/* Desktop View - Table */}
                  <div className="bg-white shadow-md rounded-2xl overflow-hidden hidden md:block">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-4 text-sm font-semibold text-slate-600">Producto</th>
                          <th className="p-4 text-sm font-semibold text-slate-600">Precio</th>
                          <th className="p-4 text-sm font-semibold text-slate-600">Costo</th>
                          <th className="p-4 text-sm font-semibold text-slate-600">Stock</th>
                          <th className="p-4 text-sm font-semibold text-slate-600 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.products.map(product => (
                          <tr key={product.id} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center">
                                <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-xl object-cover mr-4" />
                                <div>
                                  <p className="font-medium text-slate-800">{product.name}</p>
                                  <p className="text-xs text-slate-500 max-w-xs truncate">{product.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-slate-800 font-semibold">${product.price.toFixed(2)}</td>
                            <td className="p-4 text-sm text-slate-500">${product.cost.toFixed(2)}</td>
                            <td className="p-4 text-sm text-slate-500">{product.stock}</td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center items-center space-x-2">
                                <button onClick={() => openModal(product)} className="p-2 text-slate-500 hover:text-zinc-700 rounded-full hover:bg-slate-100 transition-colors">
                                  <EditIcon className="h-5 w-5" />
                                </button>
                                <button onClick={() => handleDelete(product.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors">
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View - Card Layout with Swipe Gestures */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:hidden gap-4">
                    {category.products.map(product => (
                      <div
                        key={product.id}
                        className="relative bg-white rounded-2xl shadow-md overflow-hidden touch-manipulation"
                      >
                        {/* Swipeable Card Content */}
                        <div
                          className="relative transition-transform duration-200"
                          style={{
                            transform: `translateX(${swipeX[product.id] || 0}px)`,
                          }}
                          onTouchStart={(e) => handleTouchStart(e, product.id)}
                          onTouchMove={(e) => handleTouchMove(e, product.id)}
                          onTouchEnd={() => handleTouchEnd(product.id)}
                        >
                          {/* Card Main Content */}
                          <div className="bg-white">
                            {/* Product Image - Larger on Mobile */}
                            <div className="relative h-48 overflow-hidden">
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full shadow-md">
                                <span className="text-lg font-bold text-zinc-800">${product.price.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Product Info */}
                            <div className="p-4">
                              <h3 className="font-bold text-lg text-slate-800 mb-1">{product.name}</h3>
                              {product.description && (
                                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{product.description}</p>
                              )}

                              {/* Stats Grid */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-slate-50 p-3 rounded-lg text-center">
                                  <div className="text-xs text-slate-500 mb-1">Costo</div>
                                  <div className="font-semibold text-slate-800">${product.cost.toFixed(2)}</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg text-center">
                                  <div className="text-xs text-slate-500 mb-1">Stock</div>
                                  <div className="font-semibold text-slate-800">{product.stock}</div>
                                </div>
                              </div>

                              {/* Action Buttons - Mobile Optimized */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openModal(product)}
                                  className="flex-1 flex items-center justify-center px-4 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors touch-manipulation"
                                >
                                  <EditIcon className="h-5 w-5 mr-2" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(product.id)}
                                  className={`flex-1 flex items-center justify-center px-4 py-3 rounded-xl font-medium transition-colors touch-manipulation ${
                                    deleteConfirm === product.id
                                      ? 'bg-red-600 text-white'
                                      : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600'
                                  }`}
                                >
                                  <TrashIcon className="h-5 w-5 mr-2" />
                                  {deleteConfirm === product.id ? 'Confirmar' : 'Eliminar'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Swipe Delete Indicator (Hidden Behind) */}
                        {swipeX[product.id] && swipeX[product.id] < -50 && (
                          <div className="absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center">
                            <TrashIcon className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>


      <ProductModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSave}
        productToEdit={productToEdit}
      />
      <ImportProductsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};

export default ProductsScreen;
