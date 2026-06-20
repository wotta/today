import './theme';
import Alpine from 'alpinejs';
import { planner } from './planner';
import { initSwipe } from './swipe';

window.Alpine = Alpine;
Alpine.data('planner', planner);
Alpine.start();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSwipe);
} else {
    initSwipe();
}
