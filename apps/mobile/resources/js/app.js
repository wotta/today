import './theme';
import Alpine from 'alpinejs';
import { planner } from './planner';

window.Alpine = Alpine;
Alpine.data('planner', planner);
Alpine.start();
