// Error capture script - run in browser console
window.__captureErrors = true;
window.addEventListener('error', function(e) {
  console.error('[CAPTURED ERROR]', e.error || e.message, e.filename, e.lineno, e.colno);
  window.__lastError = { message: e.error?.message || e.message, stack: e.error?.stack, time: new Date().toISOString() };
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('[UNHANDLED REJECTION]', e.reason);
  window.__lastRejection = { reason: e.reason, time: new Date().toISOString() };
});
console.log('Error capture enabled');
