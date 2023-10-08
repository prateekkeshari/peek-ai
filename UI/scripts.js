const serviceName = document.getElementById('serviceName');
const alwaysOnCheckbox = document.getElementById('alwaysOn');
const hideDockCheckbox = document.getElementById('hideDock'); // New line

const webviews = {
  'openai': document.getElementById('webview-openai'),
  'google': document.getElementById('webview-google'),
  'pi': document.getElementById('webview-pi'),
  'perplexity': document.getElementById('webview-perplexity'),
  'claude': document.getElementById('webview-claude'),
  'bing': document.getElementById('webview-bing'),
  'labs': document.getElementById('webview-labs'),
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
  webviews[id].style.display = 'none'; // Change this line
}

const webviewId = clickedElement.dataset.id;
const webview = webviews[webviewId];
webview.style.display = 'flex'; // Change this line // Add this line

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
  
  // Recalculate the controls height
  controlsHeight = document.getElementById('controls').offsetHeight;
  
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

document.addEventListener('DOMContentLoaded', function() {
  // ... Existing code ...

  const expandButton = document.getElementById('expandChatbots');
  const chatbotPanel = document.getElementById('chatbotPanel');

  expandButton.addEventListener('click', function() {
    chatbotPanel.classList.toggle('hidden');
  });
});
$(document).ready(function() {
  $('#expandChatbots').click(function() {
    if ($('#chatbotPanel').hasClass('hidden')) {
      // If the panel is hidden, show the down chevron
      $('.expand-icon').html('&#9660;');
    } else {
      // If the panel is visible, show the up chevron
      $('.expand-icon').html('&#9650;');
    }
  });
});

$(document).ready(function() {
  // Add a change event listener to each checkbox
  $('.checkbox-item input[type="checkbox"]').change(function() {
    // Get the data-id of the bot
    var botId = $(this).data('id');

    if ($(this).is(':checked')) {
      // If the checkbox is checked, show the bot in the dropdown
      $('#dropdownContent a[data-id="' + botId + '"]').show();
    } else {
      // If the checkbox is unchecked, hide the bot from the dropdown
      $('#dropdownContent a[data-id="' + botId + '"]').hide();
    }
  });
   // Get the current selection of bots
   const selectedBots = $('.checkbox-item input[type="checkbox"]:checked').map(function() {
    return this.getAttribute('data-id');
  }).get();

  // Send the selection to the main process
  myIpcRenderer.send('change-bot-selection', selectedBots);
});

$('#closeButton').click(function() {
  // Close the settings panel
  $('#configPanel').addClass('hidden');
});

$('.bot-item').click(function() {
  $('.bot-item.selected').removeClass('selected');
  $(this).addClass('selected');
});

window.addEventListener('DOMContentLoaded', () => {
  const alwaysOnTop = myIpcRenderer.sendSync('electron-store-get-data', 'alwaysOnTop') || false;
  const alwaysOnTopToggle = document.getElementById('alwaysOnToggle'); // Corrected ID
  alwaysOnTopToggle.classList.toggle('active', alwaysOnTop);
  const selectedBots = myIpcRenderer.sendSync('electron-store-get-data', 'selectedBots');
  console.log('Loaded selected bots:', selectedBots); // Debugging statement
  $('.checkbox-item input[type="checkbox"]').each(function() {
    const botId = this.getAttribute('data-id');
    this.checked = selectedBots.includes(botId);
  });
});