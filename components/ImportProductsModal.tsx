
import React, { useState, useEffect } from 'react';
import type { Product } from '../types';
import { UploadIcon } from './Icons';
import { useAppContext } from '../contexts/AppContext';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportProductsModal: React.FC<ImportProductsModalProps> = ({ isOpen, onClose }) => {
  const { importProducts } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Por favor, seleccione un archivo .csv');
        setFile(null);
      }
    }
  };

  const handleDownloadTemplate = () => {
    const headers = "name,price,cost,stock,description,category,imageUrl";
    const exampleRow = `"Café de Olla",45,15,80,"Café endulzado con piloncillo y canela.","Cafetería","https://picsum.photos/seed/cafeolla/400"`;
    const csvContent = `${headers}\n${exampleRow}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_productos.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImport = () => {
    if (!file) {
      setError("Por favor, seleccione un archivo para importar.");
      return;
    }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.trim().split(/\r?\n/);
        const headerLine = lines.shift();
        if (!headerLine) {
            throw new Error('El archivo CSV está vacío o no tiene encabezado.');
        }
        const headers = headerLine.split(',').map(h => h.trim());
        const requiredHeaders = ['name', 'price', 'cost', 'stock', 'category'];
        
        for (const reqHeader of requiredHeaders) {
            if (!headers.includes(reqHeader)) {
                throw new Error(`El archivo CSV debe contener la columna "${reqHeader}".`);
            }
        }
        
        const productsToImport: Omit<Product, 'id'>[] = lines.map(line => {
            const data = line.split(',');
            const productData: any = {};
            headers.forEach((header, index) => {
                productData[header] = data[index]?.trim().replace(/"/g, '') || '';
            });

            const category = ['Cafetería', 'Refrigerador', 'Alimentos'].includes(productData.category) 
                ? productData.category 
                : 'Cafetería';

            return {
                name: productData.name,
                price: parseFloat(productData.price) || 0,
                cost: parseFloat(productData.cost) || 0,
                stock: parseInt(productData.stock, 10) || 0,
                description: productData.description || '',
                category: category as any,
                imageUrl: productData.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(productData.name)}/400`,
            };
        }).filter(p => p.name); // Filter out any rows that might be empty

        importProducts(productsToImport);
        onClose();

      } catch (err: any) {
        setError(`Error al procesar el archivo: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
        setError('No se pudo leer el archivo.');
        setIsProcessing(false);
    }
    reader.readAsText(file);
  };

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
        setFile(null);
        setError(null);
        setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Importar Productos desde CSV</h2>
          <p className="text-sm text-slate-600 mb-4">
            Sube un archivo CSV para añadir nuevos productos o actualizar los existentes. El sistema buscará productos por el campo <code className="bg-slate-100 text-xs p-1 rounded">name</code> para actualizarlos.
          </p>
          
          <div className="bg-slate-50 p-4 rounded-xl mb-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700">Instrucciones:</p>
            <ul className="list-disc list-inside text-slate-600 text-xs">
              <li>El archivo debe ser formato .csv.</li>
              <li>La primera fila debe contener los encabezados: <code className="bg-slate-200 text-xs p-1 rounded">name,price,cost,stock,description,category,imageUrl</code>.</li>
              <li>Las columnas <code className="bg-slate-200 text-xs p-1 rounded">name</code>, <code className="bg-slate-200 text-xs p-1 rounded">price</code>, <code className="bg-slate-200 text-xs p-1 rounded">cost</code>, <code className="bg-slate-200 text-xs p-1 rounded">stock</code> y <code className="bg-slate-200 text-xs p-1 rounded">category</code> son obligatorias.</li>
              <li>Valores para <code className="bg-slate-200 text-xs p-1 rounded">category</code>: Cafetería, Refrigerador, Alimentos.</li>
              <li><button onClick={handleDownloadTemplate} className="text-blue-600 hover:underline font-medium">Descargar plantilla de ejemplo</button></li>
            </ul>
          </div>

          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-slate-600 mb-2">Seleccionar archivo CSV</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl">
              <div className="space-y-1 text-center">
                <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
                <div className="flex text-sm text-slate-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-zinc-600 hover:text-zinc-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-zinc-500">
                    <span>Sube un archivo</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                  </label>
                  <p className="pl-1">o arrástralo aquí</p>
                </div>
                {file && <p className="text-xs text-slate-500 mt-2">{file.name}</p>}
                {!file && <p className="text-xs text-slate-500">CSV hasta 1MB</p>}
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end space-x-3 rounded-b-3xl flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || isProcessing}
            className="px-4 py-2 bg-zinc-900 border border-transparent rounded-xl text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed">
            {isProcessing ? 'Procesando...' : 'Importar Productos'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportProductsModal;