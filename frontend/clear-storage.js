// Run this in browser console to clear AI chat storage
(async () => {
  // Clear localStorage
  localStorage.removeItem('chat_messages');
  localStorage.removeItem('chat_messages_fallback');
  
  // Clear IndexedDB
  const dbNames = ['rmfood_chat_storage', 'chat_storage', 'ai_chat_db'];
  for (const name of dbNames) {
    try {
      indexedDB.deleteDatabase(name);
      console.log('Deleted DB:', name);
    } catch(e) { console.log('Could not delete', name, e.message); }
  }
  
  // Also try to find any open DBs
  const allDBs = await new Promise((resolve) => {
    const req = indexedDB.open('__helper__');
    req.onupgradeneeded = () => {};
    req.onsuccess = () => { req.result.close(); resolve(true); };
    req.onerror = () => resolve(false);
    setTimeout(() => resolve(null), 1000);
  });
  
  console.log('Storage cleared. Please refresh the page.');
  alert('Storage cleared! Please refresh the page (Ctrl+Shift+R).');
})();
