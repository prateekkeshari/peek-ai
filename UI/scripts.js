const webview = document.getElementById('webview');
const urlInput = document.getElementById('urlInput');

window.addEventListener('message', (event) => {
  if (event.data === 'update_available') {
    // Notify the user that an update is available
    alert('An update is available. Downloading...');
  } else if (event.data === 'update_downloaded') {
    // Prompt the user to restart the app and apply the update
    if (confirm('Update downloaded. Restart the app to apply the update?')) {
      // Send a message to the main process to restart the app
      window.postMessage('restart_app', '*');
    }
  }
});


document.getElementById('dropdownContent').addEventListener('click', function(e) {
  e.preventDefault();
  const url = e.target.closest('a').dataset.value;
  document.getElementById('selectedImage').src = e.target.closest('a').querySelector('img').src;
  webview.loadURL(url);
});

function extractDomain(url) {
  const domain = url.replace(/(https?:\/\/)?(www\.)?/, '').split('/')[0];
  return domain;
}

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    let url = urlInput.value;
    if (url) {
      if (!/^https?:\/\//i.test(url)) {
        url = `http://${url}`;
      }
      webview.loadURL(url);
    }
  }
});

function resizeWebview() {
  const controlsHeight = document.getElementById('controls').offsetHeight;
  const windowHeight = document.documentElement.clientHeight;
  webview.style.height = `${windowHeight - controlsHeight}px`;
}

window.addEventListener('resize', resizeWebview);
resizeWebview();

webview.addEventListener('did-start-loading', () => {
  const fullUrl = webview.getURL();
  const domain = extractDomain(fullUrl);
  urlInput.value = domain;
});

urlInput.addEventListener('focus', () => {
  urlInput.value = webview.getURL();
});

urlInput.addEventListener('blur', () => {
  const fullUrl = webview.getURL();
  const domain = extractDomain(fullUrl);
  urlInput.value = domain;
});
