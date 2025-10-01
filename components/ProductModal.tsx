
import React, { useState, useEffect } from 'react';
import type { Product } from '../types';
import { SparklesIcon } from './Icons';
import { generateDescription, generateImage } from '../services/geminiService';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id'> | Product) => void;
  productToEdit?: Product | null;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, productToEdit }) => {
  const [product, setProduct] = useState({
    name: '', price: 0, cost: 0, stock: 0, description: '', imageUrl: '', category: 'Cafetería' as 'Cafetería' | 'Refrigerador' | 'Alimentos'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] my-auto flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                <input type="text" name="name" id="name" value={product.name} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm" required />
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-slate-600 mb-1">Precio de Venta</label>
                <input type="number" name="price" id="price" value={product.price} onChange={handleChange} step="0.01" className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm" required />
              </div>
              <div>
                <label htmlFor="cost" className="block text-sm font-medium text-slate-600 mb-1">Costo</label>
                <input type="number" name="cost" id="cost" value={product.cost} onChange={handleChange} step="0.01" className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm" required />
              </div>
              <div>
                <label htmlFor="stock" className="block text-sm font-medium text-slate-600 mb-1">Stock</label>
                <input type="number" name="stock" id="stock" value={product.stock} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm" required />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-600 mb-1">Categoría</label>
                <select name="category" id="category" value={product.category} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm" required>
                    <option value="Cafetería">Cafetería</option>
                    <option value="Refrigerador">Refrigerador</option>
                    <option value="Alimentos">Alimentos</option>
                </select>
               </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Imagen del Producto</label>
                    <div className="mt-1 flex items-center gap-4 p-2 bg-slate-50 rounded-xl">
                        <div className="w-24 h-24 bg-slate-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {isGeneratingImg ? (
                            <div className="w-8 h-8 border-4 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                        )}
                        </div>
                        <div className="flex flex-col">
                            <p className="text-xs text-slate-500 mb-2">Genere una imagen para el producto usando IA. Se recomienda tener un nombre de producto claro y descriptivo.</p>
                            <button 
                                type="button" 
                                onClick={handleGenerateImage} 
                                disabled={isGeneratingImg || !product.name}
                                className="flex items-center justify-center px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl shadow-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-wait transition-colors text-sm font-medium"
                            >
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                {isGeneratingImg ? 'Generando...' : 'Generar Imagen'}
                            </button>
                        </div>
                    </div>
                </div>
               <div className="md:col-span-2">
                 <label htmlFor="description" className="block text-sm font-medium text-slate-600 mb-1">Descripción</label>
                 <div className="relative">
                    <textarea name="description" id="description" value={product.description} onChange={handleChange} rows={3} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm" />
                    <button type="button" onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="absolute bottom-2 right-2 p-1.5 bg-zinc-100 text-zinc-600 rounded-full hover:bg-zinc-200 disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
                        {isGeneratingDesc ? 
                            <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                            : <SparklesIcon className="w-4 h-4" />}
                    </button>
                 </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4 flex justify-end space-x-3 rounded-b-3xl flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-zinc-900 border border-transparent rounded-xl text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;