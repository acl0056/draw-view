import { createApp } from 'vue';
import App from './App.vue';

// iOS Safari ignores user-scalable=no, so block pinch-zoom via gesture events.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
});

// Block double-tap-to-zoom: suppress a second tap that lands within 300ms.
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

createApp(App).mount('#app');
