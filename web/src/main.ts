import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { useTheme } from './composables/useTheme';
import { reveal } from './directives/reveal';
import './style.css';

// 挂载前先应用主题，避免首屏闪烁
useTheme().initTheme();

createApp(App).use(router).directive('reveal', reveal).mount('#app');
