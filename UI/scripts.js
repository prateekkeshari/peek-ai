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
  const clickedElement = e.target.closest('a');
  const id = clickedElement.getAttribute('id');

  if (id === 'settingsDropdown') {
    toggleConfigPanel();
    return;
  }

  const url = clickedElement.dataset.value;
  document.getElementById('selectedImage').src = clickedElement.querySelector('img').src;
  serviceName.textContent = clickedElement.textContent.trim();

  // Hide all webviews
  for (let id in webviews) {
    webviews[id].style.display = 'none';
  }
  
  const webviewId = clickedElement.dataset.id;
  const webview = webviews[webviewId];
  webview.style.display = 'flex';

  if (!webview.getURL()) {
    webview.loadURL(url);
  }

  resizeWebview();
});

function toggleConfigPanel() {
  if (configPanel.classList.contains('hidden')) {
    configPanel.classList.remove('hidden');
  } else {
    configPanel.classList.add('hidden');
  }
}

function resizeWebview() {
  const windowHeight = document.documentElement.clientHeight;
  
  if (!controlsHeight) {
    controlsHeight = document.getElementById('controls').offsetHeight;
  }
  
  for (let id in webviews) {
    webviews[id].style.height = `${windowHeight - controlsHeight}px`;
  }
}

window.addEventListener('resize', () => {
  controlsHeight = null;
  resizeWebview();
});

const alwaysOnCheckbox = document.getElementById('alwaysOn');

loadSettings();

alwaysOnCheckbox.addEventListener('change', function() {
  console.log("Checkbox changed: ", this.checked);
  myIpcRenderer.send('toggle-always-on-top', this.checked);
});

function saveSettings() {
  const settings = {
    alwaysOn: alwaysOnCheckbox.checked
  };
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadSettings() {
  const savedSettings = localStorage.getItem('settings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    alwaysOnCheckbox.checked = settings.alwaysOn;
  }
}
