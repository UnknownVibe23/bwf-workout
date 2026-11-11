// Single source of truth for the app version (SemVer).
// Read by the page (window.APP_VERSION, loaded via <script> in index.html)
// and by the service worker (importScripts in sw.js, used for the cache name).
// Bump once per merge to main: PATCH for fixes, MINOR for features, MAJOR for breaking changes.
var APP_VERSION = '1.1.1';
