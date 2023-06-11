const webview = document.getElementById('webview');
const serviceName = document.getElementById('serviceName');

document.getElementById('dropdownContent').addEventListener('click', function(e) {
  e.preventDefault();
  const url = e.target.closest('a').dataset.value;
  document.getElementById('selectedImage').src = e.target.closest('a').querySelector('img').src;
  serviceName.textContent = e.target.closest('a').textContent.trim();
  webview.loadURL(url);
});

window.myIpcRenderer.on('update_available', (event, newVersion) => {
  // Notify the main process that an update is available
  window.myIpcRenderer.send('prompt_update', newVersion);
});


window.myIpcRenderer.on('download_update', () => {
  // Download the update
  window.myIpcRenderer.send('start_download');
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
