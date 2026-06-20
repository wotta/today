import './theme';
import Alpine from 'alpinejs';
import { planner } from './planner';
import { initSwipe } from './swipe';

window.Alpine = Alpine;
Alpine.data('planner', planner);

// Restructure the DOM into the swipe carousel BEFORE Alpine starts, so moving
// the live day into the track doesn't churn its component state. Neighbour
// panels are inserted later and Alpine's observer initialises them on arrival.
initSwipe();
Alpine.start();
