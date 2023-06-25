const serviceName = document.getElementById('serviceName');

const webviews = {
  'openai': document.getElementById('webview-openai'),
  'google': document.getElementById('webview-google'),
  'pi': document.getElementById('webview-pi'),
  'perplexity': document.getElementById('webview-perplexity')
};

let controlsHeight;

document.getElementById('dropdownContent').addEventListener('click', function(e) {
  e.preventDefault();
  const url = e.target.closest('a').dataset.value;
  document.getElementById('selectedImage').src = e.target.closest('a').querySelector('img').src;
  serviceName.textContent = e.target.closest('a').textContent.trim();

  // Hide all webviews
  for (let id in webviews) {
    webviews[id].style.display = 'none';
  }
  const webviewId = e.target.closest('a').dataset.id; // Use the data-id attribute as the webviewId
  const webview = webviews[webviewId];


  webview.style.display = 'flex';

  // Load the URL if it hasn't been loaded yet
  if (!webview.getURL()) {
    webview.loadURL(url);
  }

  // Update the height of the webviews
  resizeWebview();
});

function resizeWebview() {
  const windowHeight = document.documentElement.clientHeight;
  
  // If controlsHeight is not defined, calculate it
  if (!controlsHeight) {
    controlsHeight = document.getElementById('controls').offsetHeight;
  }
  
  console.log('controlsHeight:', controlsHeight);
  
  // Resize all webviews
  for (let id in webviews) {
    webviews[id].style.height = `${windowHeight - controlsHeight}px`;
    console.log('webview height:', webviews[id].style.height);
  }
}

window.addEventListener('resize', () => {
  // Reset controlsHeight so it can be recalculated
  controlsHeight = null;
  resizeWebview();
});

resizeWebview();
