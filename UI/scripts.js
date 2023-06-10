const webview = document.getElementById('webview');
const serviceName = document.getElementById('serviceName');

document.getElementById('dropdownContent').addEventListener('click', function(e) {
  e.preventDefault();
  const url = e.target.closest('a').dataset.value;
  document.getElementById('selectedImage').src = e.target.closest('a').querySelector('img').src;
  serviceName.textContent = e.target.closest('a').textContent.trim();
  webview.loadURL(url);
});

window.myIpcRenderer.on('update_available', () => {
  // Notify the user that an update is available
  alert('An update is available. Downloading...');
});

window.myIpcRenderer.on('update_downloaded', () => {
  // Prompt the user to restart the app and apply the update
  if (confirm('Update downloaded. Restart the app to apply the update?')) {
    // Send a message to the main process to restart the app
    window.myIpcRenderer.send('install_update');
  }
});

document.getElementById('dropdownContent').addEventListener('click', function(e) {
  e.preventDefault();
  const url = e.target.closest('a').dataset.value;
  document.getElementById('selectedImage').src = e.target.closest('a').querySelector('img').src;
  webview.loadURL(url);
});

function resizeWebview() {
  const controlsHeight = document.getElementById('controls').offsetHeight;
  const windowHeight = document.documentElement.clientHeight;
  webview.style.height = `${windowHeight - controlsHeight}px`;
}

window.addEventListener('resize', resizeWebview);
resizeWebview();
