document.getElementById('shortcutForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const shortcut = document.getElementById('shortcut').value;
    window.myIpcRenderer.send('set_shortcut', shortcut);
  });
  