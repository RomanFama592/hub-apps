import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // Activa el modo servidor para permitir peticiones POST y lectura de archivos en tiempo real
  output: 'server',
  
  // Configura el adaptador de Node que instalaste previamente
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    {
      name: '@astrojs/image',
      options: {
        serviceEntryPoint: '@astrojs/image/sharp'
      }
    },
    {
      name: 'regenerate-images-on-start',
      hooks: {
        'astro:config:setup': async () => {
          console.log("🚀 [Astro] Verificando y regenerando imágenes de los servicios...");
          // Importa la función para regenerar imágenes
          const { regenerateImages } = await import('./src/lib/regenerateImages.ts');
          // Llama a la función para regenerar imágenes al iniciar el servidor
          const result = await regenerateImages();
          console.log(`✅ [Astro] Imágenes listas: ${result.regenerated} regeneradas, ${result.cleaned} obsoletas eliminadas.`);
        }
      }
    }
  ]
});