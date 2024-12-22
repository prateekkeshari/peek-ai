const serviceName = document.getElementById('serviceName');
let activeWebviewId = null;
const webviews = {
  'openai': document.getElementById('webview-openai'),
  'google': document.getElementById('webview-google'),
  'poe': document.getElementById('webview-poe'),
  'copilot': document.getElementById('webview-copilot'),
  'pi': document.getElementById('webview-pi'),
  'perplexity': document.getElementById('webview-perplexity'),
  'claude': document.getElementById('webview-claude'),
  'labs': document.getElementById('webview-labs'),
  'threads': document.getElementById('webview-threads'),
};
window.onbeforeunload = () => {
  localStorage.setItem('activeWebviewId', activeWebviewId);
};
window.myIpcRenderer.on('switch-webview', (event, key) => {
  // Hide the current webview
  webviews[activeWebviewId].style.display = 'none';

  // Switch to the new webview
  activeWebviewId = key;
  const newWebview = webviews[activeWebviewId];
  newWebview.style.display = 'flex';
   // Update the icon
   document.getElementById('selectedImage').src = document.querySelector(`a[data-id="${key}"] img`).src;
   serviceName.textContent = document.querySelector(`a[data-id="${key}"]`).textContent.trim();
   
  });

let controlsHeight;

for (let id in webviews) {
  webviews[id].style.display = 'none';
}
webviews['openai'].style.display = 'flex';

document.getElementById('dropdownContent').addEventListener('click', function(e) {
  e.preventDefault();
  activeWebviewId = e.target.closest('a').dataset.id; // Use the data-id attribute as the webviewId
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

// Remove duplicate closeButton event listener
document.getElementById('closeButton').addEventListener('click', function(event) {
  if (unsavedChanges) {
    event.preventDefault(); // Prevent the panel from closing
    if (confirm('Unsaved changes detected. Do you want to save changes before closing?')) {
      // If 'OK' is clicked
      // Save changes...
      document.getElementById('savePreferences').click(); // Trigger the click event of the 'Save Preferences' button
      // Close the panel after saving changes
      document.querySelector('#configPanel').classList.add('hidden');
    } else {
      // Close the panel without saving changes
      document.querySelector('#configPanel').classList.add('hidden');
    }
  } else {
    // Close the panel if there are no unsaved changes
    document.querySelector('#configPanel').classList.add('hidden');
  }
});

let unsavedChanges = false;

document.getElementById('configPanel').addEventListener('change', function(e) {
  if (e.target.tagName === 'INPUT') {
    unsavedChanges = true;
  }
});
document.getElementById('alwaysOnToggle').addEventListener('click', function() {
  unsavedChanges = true;
});
document.getElementById('hideDockToggle').addEventListener('click', function() {
  unsavedChanges = true;
});
document.getElementById('launchAtLoginToggle').addEventListener('click', function() { // New line
  unsavedChanges = true;
});

document.getElementById('key').addEventListener('change', function() {
  unsavedChanges = true;
});

document.getElementById('modifierKey').addEventListener('change', function() {
  unsavedChanges = true;
});
// Save Preferences
document.getElementById('savePreferences').addEventListener('click', function() {
  unsavedChanges = false;
  const alwaysOn = document.getElementById('alwaysOnToggle').classList.contains('active');
  const hideDock = document.getElementById('hideDockToggle').classList.contains('active');
  const launchAtLogin = document.getElementById('launchAtLoginToggle').classList.contains('active');
  const selectedKey = document.getElementById('key').value; // New line
  const selectedModifier = document.getElementById('modifierKey').value; // Corrected line
  const activeThemeButton = document.querySelector('.theme-button.active');
  const selectedTheme = activeThemeButton ? activeThemeButton.dataset.theme : 'system';
  
  const chatbots = Array.from(document.querySelectorAll('.checkbox-item input:checked'))
    .map(input => input.dataset.id);

  const preferences = {
    alwaysOnTop: alwaysOn,
    hideDockIcon: hideDock,
    launchAtLogin: launchAtLogin, // New line
    enabledChatbots: chatbots,
    selectedKey: selectedKey,
    selectedModifier: selectedModifier,
    theme: selectedTheme // Add theme to preferences
  };

  // Store theme in localStorage for persistence
  localStorage.setItem('theme', selectedTheme);

  // Send the updated preferences to the main process
  window.myIpcRenderer.send('save-preferences', preferences);

  // Hide all webviews
  for (let id in webviews) {
    webviews[id].style.display = 'none';
  }

  // Check if the current activeWebviewId is in the list of enabled chatbots
  if (preferences.enabledChatbots.includes(activeWebviewId)) {
    // If it is, keep it as the active webview
    webviews[activeWebviewId].style.display = 'flex';
  } else {
    // If it's not, set the active webview to the first enabled chatbot
    activeWebviewId = preferences.enabledChatbots[0];
    webviews[activeWebviewId].style.display = 'flex';
  }
  // Update the dropdown list
  updateDropdownList(preferences.enabledChatbots);
  // Send the keys of the active webviews to the main process
  const activeWebviewKeys = Object.keys(webviews).filter(key => preferences.enabledChatbots.includes(key));
  window.myIpcRenderer.send('active-webview-keys', activeWebviewKeys);
  // Reload all active webviews
  for (let id in webviews) {
    if (preferences.enabledChatbots.includes(id)) {
      webviews[id].reload();
    }
  }
   // Send the current webview key to the main process
   window.myIpcRenderer.send('current-webview-key', activeWebviewId);
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
      link.style.display = 'flex';
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
    document.getElementById('launchAtLoginToggle').classList.toggle('active', preferences.launchAtLogin);
    document.getElementById('modifierKey').value = preferences.selectedModifier;
    document.getElementById('key').value = preferences.selectedKey;
    if (preferences.selectedKey) {
      document.getElementById('key').value = preferences.selectedKey;
    }
 // Try to get the activeWebviewId from localStorage
 const savedWebviewId = localStorage.getItem('activeWebviewId');

 // Update chatbot checkboxes and visibility
 document.querySelectorAll('.checkbox-item input').forEach(input => {
   const isChecked = preferences.enabledChatbots.includes(input.dataset.id);
   input.checked = isChecked;
   
   // Update the visibility of webviews
   const webview = webviews[input.dataset.id];
   webview.style.display = 'none'; // Hide all webviews initially

   // If this chatbot is enabled and matches the savedWebviewId, make this the active webview
   if (isChecked && input.dataset.id === savedWebviewId) {
     activeWebviewId = savedWebviewId;
     webview.style.display = 'flex'; // Show this webview
   }
 });

 // If no activeWebviewId was set (i.e., the savedWebviewId was not enabled), set it to the first enabled chatbot
 if (!activeWebviewId) {
   activeWebviewId = preferences.enabledChatbots[0];
   webviews[activeWebviewId].style.display = 'flex'; // Show this webview
 }

 // Update the icon
 document.getElementById('selectedImage').src = document.querySelector(`a[data-id="${activeWebviewId}"] img`).src;
 serviceName.textContent = document.querySelector(`a[data-id="${activeWebviewId}"]`).textContent.trim();

 // Show the service name and icon
 document.getElementById('serviceName').style.display = 'block';
 document.getElementById('selectedImage').style.display = 'block';

    // Update the dropdown list
    updateDropdownList(preferences.enabledChatbots);

    // Set theme button state
    if (preferences.theme) {
      document.querySelectorAll('.theme-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === preferences.theme);
      });
    }
  }
  const activeWebviewKeys = Object.keys(webviews).filter(key => preferences.enabledChatbots.includes(key));
  window.myIpcRenderer.send('active-webview-keys', activeWebviewKeys);
});

// Request stored preferences from the main process
window.myIpcRenderer.send('request-preferences');
document.getElementById('alwaysOnToggle').addEventListener('click', function() {
  this.classList.toggle('active');
});
document.getElementById('hideDockToggle').addEventListener('click', function() {
  this.classList.toggle('active');
});

document.getElementById('launchAtLoginToggle').addEventListener('click', function() {
  this.classList.toggle('active');
});

document.querySelector('.save-button').addEventListener('click', function() {
  var button = this;
  button.textContent = 'Saving...';
  button.disabled = true; // Disable the button
  button.classList.add('saving'); // Add the 'saving' class

  // Simulate saving preferences
  setTimeout(function() {
    button.textContent = 'Saved';
    setTimeout(function() {
      button.textContent = 'Save Preferences';
      button.disabled = false; // Re-enable the button
      button.classList.remove('saving'); // Remove the 'saving' class
    }, 1000); // The text will change back after 2 seconds
  }, 500); // Simulate a delay for the saving operation
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

$(document).ready(function(){
  $(".checkbox-item").click(function(event){
    if(event.target.type !== 'checkbox' && event.target.tagName.toLowerCase() !== 'label') {
      $(':checkbox', this).trigger('click');
    }
  });
});

// UI/scripts.js
$(document).ready(function(){
  $(".checkbox-item").click(function(event){
    if(event.target.type !== 'checkbox' && event.target.tagName.toLowerCase() !== 'label') {
      $(':checkbox', this).trigger('click');
    }
  });

  $(".checkbox-item :checkbox").change(function(){
    if(this.checked) {
      $(this).parent().addClass('active').removeClass('inactive');
    } else {
      $(this).parent().addClass('inactive').removeClass('active');
    }
  }).change();
});

window.myIpcRenderer.on('search-perplexity', (event, text) => {
    // Hide the current webview
    webviews[activeWebviewId].style.display = 'none';

    // Switch to the Perplexity webview
    activeWebviewId = 'perplexity';
    const perplexityWebview = webviews[activeWebviewId];
    perplexityWebview.style.display = 'flex';

    // Load the URL in the Perplexity webview
    perplexityWebview.loadURL('https://www.perplexity.ai/search?q=' + encodeURIComponent(text));
});

window.myIpcRenderer.on('load-url', (event, data) => {
  const webview = document.getElementById(data.webviewId);
  if (webview) {
    webview.loadURL(data.url);
  }
});

const perplexityWebview = webviews['perplexity'];

function handleNavigation(url) {
  if (url.includes('verify-request')) {
    // Set a timeout to delay the modal display
    setTimeout(() => {
      window.myIpcRenderer.send('show-input-window');
    }, 3000); // Delay modal display by 3 seconds
  }
}

// Listen for main navigation events
perplexityWebview.addEventListener('did-navigate', (event) => {
  handleNavigation(event.url);
});

// Listen for in-page navigation events (e.g., hash changes)
perplexityWebview.addEventListener('did-navigate-in-page', (event) => {
  handleNavigation(event.url);
});


document.getElementById('key').addEventListener('keydown', function(event) {
  // Prevent any default action
  event.preventDefault();

  // Only allow letters and numbers 0-9 to be used in the shortcut
  if ((event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key))) {
    const key = event.key.toUpperCase(); // Convert the key to uppercase to standardize

    // Set the input field value to just the letter or number
    this.value = key;

    // Manually trigger the 'change' event
    this.dispatchEvent(new Event('change'));
  }
});

// Add this near the top of the file with other initialization code
let currentTheme = localStorage.getItem('theme') || 'system';

// Replace the existing theme button event listeners with this simplified version
document.addEventListener('DOMContentLoaded', () => {
  const themeButtons = document.querySelectorAll('.theme-button');
  
  // Set initial active state
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    
    btn.addEventListener('click', () => {
      // Update theme
      currentTheme = btn.dataset.theme;
      localStorage.setItem('theme', currentTheme);
      
      // Update UI
      themeButtons.forEach(button => button.classList.remove('active'));
      btn.classList.add('active');
      
      // Send to main process
      window.myIpcRenderer.send('set-theme', currentTheme);
      
      // Mark as unsaved
      unsavedChanges = true;
    });
  });
});

// Simplify the IPC listener
window.myIpcRenderer.on('set-theme', (event, theme) => {
  document.body.classList.remove('light-mode', 'dark-mode');
  if (theme !== 'system') {
    document.body.classList.add(`${theme}-mode`);
  }
});

function initializeWebviews() {
  // Set up ChatGPT webview specifically
  if (webviews.openai) {
    // Add these partition and additional preferences
    webviews.openai.partition = 'persist:chatgpt'; // Add persistent session
    webviews.openai.setUserAgent(CHATGPT_USER_AGENT);
    
    // Add loading state tracking
    let isLoading = false;
    
    webviews.openai.addEventListener('did-start-loading', () => {
      console.log('ChatGPT starting to load');
      isLoading = true;
    });

    webviews.openai.addEventListener('did-stop-loading', () => {
      console.log('ChatGPT stopped loading');
      isLoading = false;
    });

    // Handle loading errors with retry logic
    webviews.openai.addEventListener('did-fail-load', (event) => {
      console.log('ChatGPT failed to load:', event);
      
      // Only retry if we're not already loading
      if (!isLoading) {
        console.log('Retrying ChatGPT load...');
        setTimeout(() => {
          webviews.openai.reload();
        }, 2000);
      }
    });

    // Add navigation handling
    webviews.openai.addEventListener('will-navigate', (event) => {
      console.log('ChatGPT navigating to:', event.url);
    });

    // Handle DOM ready
    webviews.openai.addEventListener('dom-ready', () => {
      console.log('ChatGPT DOM ready');
      // Inject custom CSS to prevent grey screen
      webviews.openai.insertCSS(`
        body {
          background: #343541 !important;
        }
      `);
    });
  }
}

// Update handling
myIpcRenderer.on('update_available', (event, version) => {
  const indicator = document.getElementById('updateIndicator');
  indicator.classList.remove('hidden');
  indicator.title = `Version ${version} available. Click to update.`;
});

// Click handler for update dot
document.getElementById('updateIndicator').addEventListener('click', () => {
  myIpcRenderer.send('start_update');
});