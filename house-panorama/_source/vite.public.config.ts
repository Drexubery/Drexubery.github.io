import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
export default defineConfig({base:'/house-panorama/',publicDir:false,plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname,'.')}},css:{postcss:{plugins:[tailwindcss()]}},build:{outDir:'dist-public146',emptyOutDir:true,rollupOptions:{input:'index.public.html'}}});
