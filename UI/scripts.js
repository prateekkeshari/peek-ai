const serviceName = document.getElementById('serviceName');

const webviews = {
  'openai': document.getElementById('webview-openai'),
  'google': document.getElementById('webview-google'),
  'pi': document.getElementById('webview-pi'),
  'perplexity': document.getElementById('webview-perplexity'),
  'claude': document.getElementById('webview-claude'),
  'labs': document.getElementById('webview-labs'),
  'bing': document.getElementById('webview-bing')
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
// Toggle Config Panel
document.getElementById('settingsDropdown').addEventListener('click', function() {
  const configPanel = document.getElementById('configPanel');
  configPanel.classList.toggle('hidden');
});

// Close Config Panel
document.getElementById('closeButton').addEventListener('click', function() {
  const configPanel = document.getElementById('configPanel');
  configPanel.classList.add('hidden');
});

// Save Preferences
document.getElementById('savePreferences').addEventListener('click', function() {
  const alwaysOn = document.getElementById('alwaysOnToggle').classList.contains('active');
  const hideDock = document.getElementById('hideDockToggle').classList.contains('active');
  const chatbots = Array.from(document.querySelectorAll('.checkbox-item input:checked'))
    .map(input => input.dataset.id);

  const preferences = {
    alwaysOnTop: alwaysOn,
    hideDockIcon: hideDock,
    enabledChatbots: chatbots
  };

  // Send the updated preferences to the main process
  window.myIpcRenderer.send('save-preferences', preferences);

  // Update the visibility of webviews
  updateWebviewVisibility(preferences);
  // Update the dropdown list
  updateDropdownList(preferences.enabledChatbots);
});

// Update Webview Visibility based on Preferences
function updateWebviewVisibility(preferences) {
  for (let id in webviews) {
    const webview = webviews[id];
    if (preferences.enabledChatbots.includes(id)) {
      webview.style.display = 'flex';
    } else {
      webview.style.display = 'none';
    }
  }
}

// Update the dropdown list
function updateDropdownList(enabledChatbots) {
  const dropdownContent = document.getElementById('dropdownContent');
  const allLinks = Array.from(dropdownContent.querySelectorAll('a[data-id]'));
  
  allLinks.forEach(link => {
    const botId = link.getAttribute('data-id');
    if (enabledChatbots.includes(botId)) {
      link.style.display = 'block';
    } else {
      link.style.display = 'none';
    }
  });
}

// Update the list of chatbots under "Your Chatbots"
function updateChatbotList(enabledChatbots) {
  const yourChatbotsContainer = document.getElementById('yourChatbotsContainer'); // Replace with the actual ID
  yourChatbotsContainer.innerHTML = ''; // Clear the current list

  enabledChatbots.forEach(botId => {
    // Create new list item
    const listItem = document.createElement('li');
    listItem.textContent = botId; // Replace with the actual bot name if needed
    listItem.classList.add('chatbot-list-item'); // Add any necessary classes
    // Add click handlers if needed
    yourChatbotsContainer.appendChild(listItem);
  });
}
// Initialize UI based on loaded preferences
window.myIpcRenderer.on('load-preferences', (event, preferences) => {
  if (preferences) {
    // Update toggle buttons
    document.getElementById('alwaysOnToggle').classList.toggle('active', preferences.alwaysOnTop);
    document.getElementById('hideDockToggle').classList.toggle('active', preferences.hideDockIcon);

    // Update chatbot checkboxes and visibility
    document.querySelectorAll('.checkbox-item input').forEach(input => {
      const isChecked = preferences.enabledChatbots.includes(input.dataset.id);
      input.checked = isChecked;
      
      // Update the visibility of webviews
      const webview = webviews[input.dataset.id];
      webview.style.display = isChecked ? 'flex' : 'none';
    });

    // Update the dropdown list
    updateDropdownList(preferences.enabledChatbots);
    updateWebviewVisibility(preferences);
  }
});

// Request stored preferences from the main process
window.myIpcRenderer.send('request-preferences');
document.getElementById('alwaysOnToggle').addEventListener('click', function() {
  this.classList.toggle('active');
});
document.getElementById('hideDockToggle').addEventListener('click', function() {
  this.classList.toggle('active');
});
document.getElementById('expandChatbots').addEventListener('click', function() {
  const panel = document.getElementById('chatbotPanel');
  panel.classList.toggle('hidden');
});
document.getElementById('chatbotPanel').addEventListener('change', function(e) {
  if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
    savePreferences();
  }
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


