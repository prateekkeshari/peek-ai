const serviceName = document.getElementById('serviceName');

const webviews = {
  'openai': document.getElementById('webview-openai'),
  'google': document.getElementById('webview-google'),
  'poe': document.getElementById('webview-poe'),
  'bing': document.getElementById('webview-bing'),
  'pi': document.getElementById('webview-pi'),
  'perplexity': document.getElementById('webview-perplexity'),
  'claude': document.getElementById('webview-claude'),
  'labs': document.getElementById('webview-labs'),
};

let controlsHeight;

for (let id in webviews) {
  webviews[id].style.display = 'none';
}
webviews['openai'].style.display = 'flex';

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
// Save Preferences
document.getElementById('savePreferences').addEventListener('click', function() {
  unsavedChanges = false;
  const alwaysOn = document.getElementById('alwaysOnToggle').classList.contains('active');
  const hideDock = document.getElementById('hideDockToggle').classList.contains('active');
  const launchAtLogin = document.getElementById('launchAtLoginToggle').classList.contains('active'); // New line
  const chatbots = Array.from(document.querySelectorAll('.checkbox-item input:checked'))
    .map(input => input.dataset.id);

  const preferences = {
    alwaysOnTop: alwaysOn,
    hideDockIcon: hideDock,
    launchAtLogin: launchAtLogin, // New line
    enabledChatbots: chatbots
  };

  // Send the updated preferences to the main process
  window.myIpcRenderer.send('save-preferences', preferences);

  // Hide all webviews and show only 'openai' webview
  for (let id in webviews) {
    webviews[id].style.display = 'none';
  }
  webviews['openai'].style.display = 'flex';

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

    // Update chatbot checkboxes and visibility
    document.querySelectorAll('.checkbox-item input').forEach(input => {
      const isChecked = preferences.enabledChatbots.includes(input.dataset.id);
      input.checked = isChecked;
      
      // Update the visibility of webviews
      const webview = webviews[input.dataset.id];
      // Only show 'openai' webview when the app loads
      webview.style.display = input.dataset.id === 'openai' ? 'flex' : 'none';
    });

    // Update the dropdown list
    updateDropdownList(preferences.enabledChatbots);
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