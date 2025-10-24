
import React, { useState, useEffect } from 'react';
import type { Product } from '../types';
import { SparklesIcon } from './Icons';
import { generateDescription, generateImage } from '../services/aiService';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id'> | Product) => void;
  productToEdit?: Product | null;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, productToEdit }) => {
  const [product, setProduct] = useState({
    name: '', price: 0, cost: 0, stock: 0, description: '', imageUrl: '', category: 'Cafetería' as 'Cafetería' | 'Refrigerador' | 'Alimentos' | 'Membresías'
  });
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setProduct(productToEdit);
    } else {
      setProduct({ name: '', price: 0, cost: 0, stock: 0, description: '', imageUrl: '', category: 'Cafetería' });
    }
  }, [productToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProduct(prev => ({ ...prev, [name]: name === 'price' || name === 'stock' || name === 'cost' ? parseFloat(value) || 0 : value }));
  };

  const handleGenerateDescription = async () => {
    if (!product.name) {
      alert("Por favor, ingrese un nombre de producto primero.");
      return;
    }
    setIsGeneratingDesc(true);
    try {
      const keywords = product.category ? `${product.category}, premium, calidad` : 'premium, calidad';
      const description = await generateDescription(product.name, keywords);
      setProduct(prev => ({...prev, description}));
    } catch (error) {
       console.error("Error generating description:", error);
       alert(error instanceof Error ? error.message : "Error al generar la descripción");
    } finally {
        setIsGeneratingDesc(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!product.name) {
      alert("Por favor, ingrese un nombre de producto primero.");
      return;
    }
    setIsGeneratingImg(true);
    try {
      const imageUrl = await generateImage(product.name, product.description);
      setProduct(prev => ({...prev, imageUrl}));
    } catch (error) {
       console.error(error);
    } finally {
        setIsGeneratingImg(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.imageUrl) {
        alert("Por favor, genere una imagen para el producto.");
        return;
    }
    onSave(product);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end md:items-center p-0 md:p-4 overflow-hidden">
      {/* Mobile: Full screen from bottom, Desktop: Centered modal */}
      <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-xl w-full md:max-w-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col animate-slide-up">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Header - Fixed */}
          <div className="p-4 md:p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors touch-manipulation"
            >
              <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-4 md:p-6 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name - Full Width */}
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-base font-medium text-slate-700 mb-2">Nombre del Producto</label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={product.name}
                  onChange={handleChange}
                  inputMode="text"
                  className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation"
                  placeholder="Ej: Café Americano Grande"
                  required
                />
              </div>

              {/* Price Input - Numeric keyboard */}
              <div>
                <label htmlFor="price" className="block text-base font-medium text-slate-700 mb-2">Precio de Venta</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">$</span>
                  <input
                    type="number"
                    name="price"
                    id="price"
                    value={product.price}
                    onChange={handleChange}
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 pl-8 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Cost Input - Numeric keyboard */}
              <div>
                <label htmlFor="cost" className="block text-base font-medium text-slate-700 mb-2">Costo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">$</span>
                  <input
                    type="number"
                    name="cost"
                    id="cost"
                    value={product.cost}
                    onChange={handleChange}
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 pl-8 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Stock Input - Numeric keyboard */}
              <div>
                <label htmlFor="stock" className="block text-base font-medium text-slate-700 mb-2">Stock Inicial</label>
                <input
                  type="number"
                  name="stock"
                  id="stock"
                  value={product.stock}
                  onChange={handleChange}
                  inputMode="numeric"
                  min="0"
                  className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation"
                  placeholder="0"
                  required
                />
              </div>

              {/* Category Selector - Touch friendly */}
              <div>
                <label htmlFor="category" className="block text-base font-medium text-slate-700 mb-2">Categoría</label>
                <select
                  name="category"
                  id="category"
                  value={product.category}
                  onChange={handleChange}
                  className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation bg-white"
                  required
                >
                  <option value="Cafetería">☕ Cafetería</option>
                  <option value="Refrigerador">🧊 Refrigerador</option>
                  <option value="Alimentos">🍞 Alimentos</option>
                  <option value="Membresías">💼 Membresías de Coworking</option>
                </select>
              </div>
              {/* Image Upload - Mobile Optimized with Camera Access */}
              <div className="md:col-span-2">
                <label className="block text-base font-medium text-slate-700 mb-2">Imagen del Producto</label>
                <div className="bg-slate-50 rounded-xl p-4">
                  {/* Image Preview - Larger on mobile */}
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="w-full md:w-32 h-40 md:h-32 bg-slate-200 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {isGeneratingImg ? (
                        <div className="w-10 h-10 border-4 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                        </svg>
                      )}
                    </div>

                    {/* Action Buttons - Stacked on mobile */}
                    <div className="flex-1 w-full space-y-3">
                      <p className="text-sm text-slate-600">Genere una imagen para el producto usando IA. Se recomienda tener un nombre descriptivo.</p>
                      <button
                        type="button"
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImg || !product.name}
                        className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all font-medium touch-manipulation"
                      >
                        <SparklesIcon className="w-5 h-5 mr-2" />
                        {isGeneratingImg ? 'Generando Imagen...' : 'Generar con IA'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description - Mobile Optimized */}
              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-base font-medium text-slate-700 mb-2">Descripción</label>
                <div className="relative">
                  <textarea
                    name="description"
                    id="description"
                    value={product.description}
                    onChange={handleChange}
                    rows={4}
                    inputMode="text"
                    className="block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-4 text-base focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 touch-manipulation resize-none"
                    placeholder="Descripción del producto (opcional)"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDesc || !product.name}
                    className="absolute bottom-3 right-3 p-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm touch-manipulation"
                    title="Generar descripción con IA"
                  >
                    {isGeneratingDesc ? (
                      <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <SparklesIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="bg-slate-50 p-4 md:px-6 md:py-4 flex flex-col-reverse md:flex-row gap-3 md:justify-end border-t border-slate-200 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full md:w-auto px-6 py-3 bg-white border-2 border-slate-300 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full md:w-auto px-6 py-3 bg-zinc-900 border-2 border-transparent rounded-xl text-base font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 shadow-md touch-manipulation"
            >
              {productToEdit ? 'Actualizar Producto' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;