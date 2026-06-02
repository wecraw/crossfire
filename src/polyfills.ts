/**
 * Application polyfills loaded before the app (zone.js is added via angular.json).
 */

// Load `$localize` onto the global scope - used if i18n tags appear in templates.
import '@angular/localize/init';

// Some browser libraries expect a Node-style `process` global to exist.
(window as unknown as { process: { env: Record<string, string | undefined> } }).process = {
  env: { DEBUG: undefined },
};
