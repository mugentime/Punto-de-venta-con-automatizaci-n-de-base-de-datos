export const generateDescription = async (productName: string, keywords: string): Promise<string> => {
  try {
    const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, keywords }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData.error);
        throw new Error(errorData.error || 'Server error');
    }
    
    const data = await response.json();
    return data.description;
  } catch (error) {
    console.error("Error fetching description:", error);
    if (error instanceof Error) {
      throw new Error(`Error al generar descripción: ${error.message}`);
    }
    throw new Error("No se pudo generar la descripción. Por favor, verifique su conexión e inténtelo de nuevo.");
  }
};

export const generateImage = async (productName: string, description?: string): Promise<string> => {
  try {
    const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, description }),
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData.error);
        throw new Error(errorData.error || 'Server error');
    }

    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error("Error fetching image:", error);
    return "https://picsum.photos/seed/error/400"; // fallback
  }
};
