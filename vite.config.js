import {defineConfig} from 'vite';
export default defineConfig(({mode})=>({base:mode==='pages'?'/memory-sky/':'/'}));
