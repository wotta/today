import './theme';
import Alpine from 'alpinejs';
import { planner } from './planner';
import { initSwipe } from './swipe';
import { startGistSync } from './sync';
import { initPullToRefresh } from './pulldown';

window.Alpine = Alpine;
Alpine.data('planner', planner);

// Restructure the DOM into the swipe carousel BEFORE Alpine starts, so moving
// the live day into the track doesn't churn its component state. Neighbour
// panels are inserted later and Alpine's observer initialises them on arrival.
const swipeViewport = initSwipe();
Alpine.start();

// Poll the Gist for remote edits (extension / other devices) and let each
// planner panel patch itself in place. Runs only while the app is foregrounded.
startGistSync();

// Pull down from the top of the planner to force a sync on demand.
initPullToRefresh(swipeViewport);
