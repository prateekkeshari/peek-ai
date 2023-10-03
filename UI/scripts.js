const serviceName = document.getElementById('serviceName');
const alwaysOnCheckbox = document.getElementById('alwaysOn');
const hideDockCheckbox = document.getElementById('hideDock'); // New line

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

// Load settings
loadSettings();
// Attach click event to toggle-buttons
document.querySelectorAll('.toggle-button').forEach(button => {
  button.addEventListener('click', function() {
    this.classList.toggle('active');
    const isActive = this.classList.contains('active');

    if (this.id === 'alwaysOnToggle') {
      console.log('Always-On Floating Window: ', isActive);
      myIpcRenderer.send('toggle-always-on-top', isActive);
    }

    if (this.id === 'hideDockToggle') {
      console.log('Hide Dock Icon: ', isActive);
      myIpcRenderer.send('toggle-dock-icon', isActive);
    }

    saveSettings();
  });
});

function saveSettings() {
  const settings = {
    alwaysOn: document.getElementById('alwaysOnToggle').classList.contains('active'),
    hideDock: document.getElementById('hideDockToggle').classList.contains('active')
  };
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadSettings() {
  const savedSettings = localStorage.getItem('settings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    if (settings.alwaysOn) {
      document.getElementById('alwaysOnToggle').classList.add('active');
    }
    if (settings.hideDock) {
      document.getElementById('hideDockToggle').classList.add('active');
    }
  }
}