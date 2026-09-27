import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // Activa el modo servidor para permitir peticiones POST y lectura de archivos en tiempo real
  output: 'server',
  
  // Configura el adaptador de Node que instalaste previamente
  adapter: node({
    mode: 'standalone'
  })
});