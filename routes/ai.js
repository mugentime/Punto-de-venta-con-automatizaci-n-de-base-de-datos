// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createAiRouter({ aiRateLimiter }) {
    const router = express.Router();

    // --- AI ENDPOINTS ---
    router.post('/api/generate-description', aiRateLimiter, async (req, res) => {
      const { productName, keywords } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }

      try {
        console.log(`Generating description for product: ${productName} with keywords: ${keywords || 'none'}`);

        // Use HuggingFace Inference API (FREE, no API key needed for public models)
        const prompt = `Escribe una descripción de producto profesional y atractiva para: ${productName}${keywords ? `. Palabras clave: ${keywords}` : ''}. La descripción debe ser elegante, concisa (máximo 2-3 frases), enfocarse en beneficios y calidad. Responde SOLO con la descripción, sin comillas.`;

        const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 100,
              temperature: 0.7,
              top_p: 0.9,
              return_full_text: false
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HuggingFace API error: ${response.status}`);
        }

        const data = await response.json();
        let description = data[0]?.generated_text || '';

        // Clean up the description
        description = description
          .trim()
          .replace(/^["']|["']$/g, '') // Remove quotes
          .split('\n')[0] // Take first paragraph
          .substring(0, 300); // Limit length

        console.log(`Description generated successfully: ${description.substring(0, 100)}...`);
        res.json({ description });
      } catch (error) {
        console.error("Error generating description with HuggingFace:", error);
        console.error("Error details:", error.message);

        // Fallback to template-based description
        const category = keywords || 'calidad';
        const fallbackDescription = `${productName} de ${category} premium. Producto seleccionado con los más altos estándares de calidad para garantizar tu satisfacción.`;

        console.log('Using fallback description:', fallbackDescription);
        res.json({ description: fallbackDescription });
      }
    });

    router.post('/api/generate-image', aiRateLimiter, async (req, res) => {
      const { productName, description } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }

      try {
        // Create detailed AI prompt from product name and description
        const aiPrompt = description
          ? `professional food photography of ${productName}, ${description}, high quality, detailed, appetizing, restaurant style`
          : `professional food photography of ${productName}, high quality, detailed, appetizing, restaurant style`;

        const encodedPrompt = encodeURIComponent(aiPrompt);

        console.log(`🎨 AI Image Generation for: "${productName}"`);
        console.log(`📝 Using description: "${description || 'none'}"`);
        console.log(`🤖 AI Prompt: "${aiPrompt}"`);

        let imageUrl = null;
        let serviceUsed = null;

        // 🎨 Service 1: Pollinations.ai (PRIMARY - Real AI image generation)
        try {
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=400&height=400&model=flux&nologo=true`;
          console.log(`🌸 Trying Pollinations.ai...`);

          // Do a partial GET request to verify there's actual content
          const testResponse = await fetch(pollinationsUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(30000) // 30 seconds for AI generation
          });

          if (testResponse.ok) {
            // Read first few bytes to verify there's content
            const reader = testResponse.body.getReader();
            const { value, done } = await reader.read();
            reader.releaseLock();

            if (value && value.length > 0) {
              imageUrl = pollinationsUrl;
              serviceUsed = 'Pollinations.ai (AI-generated)';
              console.log(`✅ AI Image generated via Pollinations.ai for: ${productName} (verified ${value.length} bytes)`);
            } else {
              console.log(`⚠️  Pollinations.ai returned empty response, falling back to next service...`);
            }
          }
        } catch (error) {
          console.log(`❌ Pollinations.ai failed (${error.message}), trying HuggingFace...`);
        }

        // 🤗 Service 2: HuggingFace Stable Diffusion (BACKUP - Real AI)
        if (!imageUrl) {
          try {
            console.log(`🤗 Trying HuggingFace Stable Diffusion...`);

            const hfResponse = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: aiPrompt,
                parameters: {
                  width: 400,
                  height: 400,
                  num_inference_steps: 30
                }
              }),
              signal: AbortSignal.timeout(30000) // 30 seconds for AI generation
            });

            if (hfResponse.ok) {
              const blob = await hfResponse.blob();
              // Convert blob to base64 data URL
              const reader = new FileReader();
              const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              imageUrl = await base64Promise;
              serviceUsed = 'HuggingFace Stable Diffusion (AI-generated)';
              console.log(`✅ AI Image generated via HuggingFace for: ${productName}`);
            }
          } catch (error) {
            console.log(`❌ HuggingFace failed (${error.message}), trying Lexica...`);
          }
        }

        // 🎭 Service 3: Lexica.art API (AI art search - finds existing AI-generated images)
        if (!imageUrl) {
          try {
            console.log(`🎭 Trying Lexica.art AI search...`);

            const lexicaResponse = await fetch(`https://lexica.art/api/v1/search?q=${encodeURIComponent(productName)}`, {
              signal: AbortSignal.timeout(5000)
            });

            if (lexicaResponse.ok) {
              const lexicaData = await lexicaResponse.json();
              if (lexicaData.images && lexicaData.images.length > 0) {
                // Get the first result (most relevant)
                imageUrl = lexicaData.images[0].src;
                serviceUsed = 'Lexica.art (AI art search)';
                console.log(`✅ AI-generated image found via Lexica.art for: ${productName}`);
              }
            }
          } catch (error) {
            console.log(`❌ Lexica.art failed (${error.message}), using Picsum placeholder...`);
          }
        }

        // 🖼️ Service 4: Picsum placeholder (EMERGENCY FALLBACK - not AI)
        if (!imageUrl) {
          console.log(`⚠️  All AI services failed, using Picsum placeholder...`);
          // Create a hash from product name to get consistent but unique image
          let hash = 0;
          for (let i = 0; i < productName.length; i++) {
            hash = ((hash << 5) - hash) + productName.charCodeAt(i);
            hash = hash & hash;
          }
          const imageId = Math.abs(hash % 1000);

          imageUrl = `https://picsum.photos/id/${imageId}/400`;
          serviceUsed = 'Picsum placeholder (emergency fallback)';
          console.log(`⚠️  Using Picsum placeholder #${imageId} for: ${productName}`);
        }

        console.log(`🖼️  Image service used: ${serviceUsed}`);
        console.log(`🔗 Final image URL: ${imageUrl.substring(0, 100)}...`);

        res.json({
          imageUrl,
          service: serviceUsed,
          prompt: aiPrompt,
          isAiGenerated: serviceUsed.includes('AI') || serviceUsed.includes('Pollinations') || serviceUsed.includes('HuggingFace') || serviceUsed.includes('Lexica')
        });
      } catch (error) {
        console.error("❌ Error generating image:", error);
        // Emergency fallback with product name as text
        const placeholderText = encodeURIComponent(req.body.productName.substring(0, 30));
        res.json({
          imageUrl: `https://via.placeholder.com/400x400/dc2626/FFFFFF?text=${placeholderText}`,
          service: 'Emergency placeholder',
          error: error.message
        });
      }
    });

    return router;
}
