const { app, nativeTheme, Menu, MenuItem, BrowserWindow, globalShortcut, Tray, nativeImage, ipcMain, shell, screen, systemPreferences } = require('electron');
const { processImage, captureAndProcessImage, screenshotToClipboard, saveScreenshot, setMainWindow, setIcon } = require('./screenshot.js');
const { createAppMenu, createContextMenu, createWebviewContextMenu } = require('./menu.js');
const {is} = require('electron-util');
const Store = require('electron-store');
const store = new Store();
const ProgressBar = require('electron-progressbar');
const path = require('path');
const log = require('electron-log');
const url = require('url');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
let mainWindow;
let tray;
let icon;
let manualUpdateCheck = false;
let reminderTimeout;
let userChoseToDownloadUpdate = false;
let lastVersion = store.get('version');
const currentVersion = app.getVersion();

if (!lastVersion || lastVersion !== currentVersion) {
  // This is either a first-time user or the app was updated
  store.set('version', currentVersion);
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
}
let currentWebviewKey = 'openai';

ipcMain.on('active-webview-keys', (event, keys) => {
  activeWebviewKeys = keys;

  // If the current webview key is not in the new keys, reset it to the first key
  if (!activeWebviewKeys.includes(currentWebviewKey)) {
    currentWebviewKey = activeWebviewKeys[0];
  }
});

ipcMain.on('current-webview-key', (event, key) => {
  currentWebviewKey = key;
});
try {
  require('electron-reloader')(module, {
    watchRenderer: true,
    ignore: ["*.js", "*.map"],
    watch: ["*.html", "*.css"]
  });
} catch (_) {}


function createWindow() {
  let preferences = loadPreferences();

  mainWindow = new BrowserWindow({
    width: 450,
    height: 700,
    minWidth: 450, // Set the minimum width
    minHeight: 500, // Set the minimum height
    show: false,
    frame:false,
    transparent:true,
    fullscreenable: true,
    resizable: true,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    alwaysOnTop: preferences.alwaysOnTop,
  });
  
  preferences = store.get('preferences');
  mainWindow.webContents.send('load-preferences', preferences);
  mainWindow.loadURL('about:blank');

  app.whenReady().then(() => {
    const setTrayIcon = () => {
      const iconFileName = process.platform === 'darwin' ? 'IconTemplate.png' : 'icon.png';
      const iconPath = path.join(__dirname, 'icons', iconFileName);
      
      try {
        if (!fs.existsSync(iconPath)) {
          throw new Error(`Tray icon not found at: ${iconPath}`);
        }
        
        const trayIcon = nativeImage.createFromPath(iconPath);
        if (!tray) {
          tray = new Tray(trayIcon);
        } else {
          tray.setImage(trayIcon);
        }
      } catch (error) {
        console.error('Error with tray icon:', error);
      }
    };
  
    const contextMenu = createContextMenu(mainWindow);
  
    if (tray) {
      tray.on('right-click', () => {
        tray.popUpContextMenu(contextMenu);
      });
      
      let isWindowVisible = true;
  
      // Add a click event listener to the tray icon
      tray.on('click', () => {
        if (isWindowVisible) {
          hideWindow();
          isWindowVisible = false;
        } else {
          showWindow();
          isWindowVisible = true;
        }
      });
    } else {
      console.warn('Tray icon not found. Right-click event listener not set.');
    }
  
    setTrayIcon(); // Set the initial icon based on the current theme
  
    nativeTheme.on('updated', () => {
      setTrayIcon(); // Update the icon when the system theme changes
    });
  });
    
  mainWindow.once('ready-to-show', () => {
    const appMenu = createAppMenu(mainWindow);
    Menu.setApplicationMenu(appMenu);
    const menu = createAppMenu(mainWindow, globalShortcut);
    Menu.setApplicationMenu(menu);
    
    mainWindow.show();
  });
  // Pass 'webContents' to 'createWebviewContextMenu' when calling it
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    // Enable permissions for the webview
    webContents.session.setPermissionRequestHandler(async (webContents, permission, callback) => {
      if (permission === 'media') {
        // Only check system permission when media access is requested
        if (process.platform === 'darwin') {
          const status = systemPreferences.getMediaAccessStatus('microphone');
          
          if (status === 'not-determined') {
            // Only ask for permission when first requested by a webview
            try {
              const granted = await systemPreferences.askForMediaAccess('microphone');
              callback(granted);
            } catch (err) {
              console.error('Error requesting microphone permission:', err);
              callback(false);
            }
          } else {
            // Use existing permission status
            callback(status === 'granted');
          }
        } else {
          callback(true); // Non-macOS platforms
        }
      } else {
        callback(true); // Other permissions
      }
    });

    // Set up media device permissions check
    webContents.session.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'media') {
        return process.platform === 'darwin' 
          ? systemPreferences.getMediaAccessStatus('microphone') === 'granted'
          : true;
      }
      return true;
    });

    // For macOS, we need to handle permissions differently
    if (process.platform === 'darwin') {
      webContents.on('select-bluetooth-device', (event, devices, callback) => {
        event.preventDefault();
        // Handle Bluetooth separately if needed
      });
      
      // Use system level permission check
      webContents.session.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'media') {
          return systemPreferences.getMediaAccessStatus('microphone') === 'granted';
        }
        return true;
      });
    }

    webContents.on('context-menu', (e, params) => {
      const webviewContextMenu = createWebviewContextMenu(params, webContents, mainWindow);
      webviewContextMenu.popup(webContents.getOwnerBrowserWindow());
    });
  });

  // Enable screen wake lock
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(true);
    }
  });

  mainWindow.on('focus', () => {
    // saved the screenshot
    globalShortcut.register('CommandOrControl+Shift+S', saveScreenshot);

    // copy the screenshot to clipboard 
    globalShortcut.register('CommandOrControl+S', screenshotToClipboard);
    let currentWebviewKey = 'openai';

globalShortcut.register('Cmd+Ctrl+Right', () => {
  // Calculate the new key
  const newIndex = (activeWebviewKeys.indexOf(currentWebviewKey) + 1) % activeWebviewKeys.length;
  currentWebviewKey = activeWebviewKeys[newIndex];

  // Send the new key to the renderer process
  mainWindow.webContents.send('switch-webview', currentWebviewKey);
});

globalShortcut.register('Cmd+Ctrl+Left', () => {
  // Calculate the new key
  const newIndex = (activeWebviewKeys.indexOf(currentWebviewKey) - 1 + activeWebviewKeys.length) % activeWebviewKeys.length;
  currentWebviewKey = activeWebviewKeys[newIndex];

  // Send the new key to the renderer process
  mainWindow.webContents.send('switch-webview', currentWebviewKey);
});
  });

  // unregister the shortcuts
  mainWindow.on('blur', () => {
    // When the window loses focus, unregister the shortcuts
    globalShortcut.unregister('CommandOrControl+Shift+S');
    globalShortcut.unregister('CommandOrControl+S');
    globalShortcut.unregister('Cmd+Ctrl+Right');
    globalShortcut.unregister('Cmd+Ctrl+Left');
  });

  mainWindow.on('close', (event) => {
    event.preventDefault(); // Prevent the close from happening
    mainWindow.hide(); // Hide the window instead of closing it
});
  setMainWindow(mainWindow);
  setIcon(icon);

  // Load saved dark mode preference
  const savedDarkMode = store.get('darkMode');
  if (savedDarkMode !== undefined) {
    nativeTheme.themeSource = savedDarkMode ? 'dark' : 'light';
  }
}

let windowPosition = null;

function hideWindow() {
  windowPosition = mainWindow.getBounds();
  mainWindow.hide();
}

function showWindow() {
  // Check if windowPosition is not null
  if (windowPosition) {
    // Set the window position to the saved position
    mainWindow.setBounds(windowPosition, false);
  }

  // Show the window
  mainWindow.show();
}
app.on('web-contents-created', (webContentsCreatedEvent, contents) => {
  if (contents.getType() === 'webview') {
    contents.on('new-window', (newWindowEvent, url) => {
      newWindowEvent.preventDefault();
      shell.openExternal(url);
    });
  }
});


function registerShortcut(preferences) {
  if (preferences.selectedKey && preferences.selectedModifier) {
    const shortcut = `${preferences.selectedModifier}+${preferences.selectedKey}`;
    globalShortcut.register(shortcut, toggleWindow);
  }
}


app.on('ready', () => {
  // Set the app name
  app.setName('Peek');
  let preferences = loadPreferences();
  if (preferences.hideDockIcon) {
    app.dock.hide();
  }

  // Register the shortcut
  registerShortcut(preferences);

  // Set the Dock icon
  const iconPath = path.join(__dirname, '/icons/peek-dock-icon.png');
  icon = nativeImage.createFromPath(iconPath);
  app.dock.setIcon(icon);

  createWindow();
  ipcMain.on('check_for_update', () => {
    manualUpdateCheck = true;
    autoUpdater.checkForUpdates();
  });
});

ipcMain.on('request-preferences', (event) => {
  const preferences = loadPreferences();
  mainWindow.webContents.send('load-preferences', preferences);
});

let oldPreferences = loadPreferences();

ipcMain.on('save-preferences', (event, updatedPreferences) => {
  // Save the updated preferences
  savePreferences(updatedPreferences);

  // Apply the 'alwaysOnTop' preference
  if (updatedPreferences.alwaysOnTop !== undefined) {
    mainWindow.setAlwaysOnTop(updatedPreferences.alwaysOnTop);
  }

  // Apply the 'hideDockIcon' preference
  if (updatedPreferences.hideDockIcon !== undefined) {
    if (updatedPreferences.hideDockIcon) {
      app.dock.hide();
    } else {
      app.dock.show();
    }
  }

  // Apply the 'launchAtLogin' preference
  if (updatedPreferences.launchAtLogin !== undefined) {
    app.setLoginItemSettings({ openAtLogin: updatedPreferences.launchAtLogin });
  }

  // Apply the 'selectedKey' and 'selectedModifier' preferences
  if (updatedPreferences.selectedKey !== undefined && updatedPreferences.selectedModifier !== undefined) {
    const newShortcut = `${updatedPreferences.selectedModifier}+${updatedPreferences.selectedKey}`;
    globalShortcut.unregisterAll();
    globalShortcut.register(newShortcut, toggleWindow);
  }

  // Apply the 'enabledChatbots' preference
  // This is just an example. You need to replace it with the actual code that applies this preference.
  if (updatedPreferences.enabledChatbots !== undefined) {
    // Apply the 'enabledChatbots' preference
  }
});

let updateInterval;

app.whenReady().then(() => {
  createWindow();
  const currentVersion = app.getVersion();

  let lastVersion = store.get('version');

  let hasRunBefore = store.get('hasRunBefore');

  let pageToLoad;

  if (!hasRunBefore || !lastVersion || lastVersion !== currentVersion) {
    // This is either a first-time user or the app was updated
    store.set('hasRunBefore', true);
    store.set('version', currentVersion);
    // Show the onboarding screen
    pageToLoad = `file://${__dirname}/UI/onboarding.html`;
  } else {
    pageToLoad = `file://${__dirname}/UI/index.html`;
  }

  mainWindow.loadURL(pageToLoad);
  if (is.macos && !app.isInApplicationsFolder()) {
    const choice = dialog.showMessageBoxSync({
      type: 'question',
      buttons: ['Move to Applications Folder', 'Do Not Move'],
      defaultId: 0,
      message: 'To receive future updates, move this to the Applications folder. You can safely delete the file from the downloaded folder after moving.'
    });
    if (choice === 0) {
      try {
        app.moveToApplicationsFolder();
      } catch {
        console.error('Failed to move app to Applications folder.');
      }
    }
  }

  autoUpdater.checkForUpdates();

  // Set autoInstallOnAppQuit to true to apply updates silently
  autoUpdater.autoInstallOnAppQuit = false;

  // Listen for the 'error' event and handle it
  autoUpdater.on('error', (error) => {
    log.error('Error in auto-updater', error);
    console.error('There was a problem updating the application');
    console.error(error);
    // Optionally, you could notify the user that there was a problem
  });
  // Check for updates every 24 hours
  updateInterval = setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 24 * 60* 60* 1000);
  
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.on('ipc-message', (event, channel) => {
      if (channel === 'restart_app') {
        autoUpdater.quitAndInstall();
      }
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('will-quit', () => {
  // Unregister the global shortcut
  globalShortcut.unregisterAll();
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available', info);
  mainWindow.webContents.send('update_available', info.version);
});

autoUpdater.on('update-not-available', () => {
  if (manualUpdateCheck) {
    dialog.showMessageBox({
      type: 'info',
      title: 'No Updates',
      message: 'You are on the latest version!'
    });
    manualUpdateCheck = false;
  }
});


let progressBar;

autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update available ⚡',
    message: `Hello there! A new version (${info.version}) of Peek is available.`,
    buttons: ['Remind me later', 'Install & Restart']
  }).then((result) => {
    if (result.response === 1) {
      userChoseToDownloadUpdate = true;

      progressBar = new ProgressBar({
        indeterminate: false,
        title: 'Downloading Update',
        text: 'Please wait...',
        detail: 'Download in progress...',
        browserWindow: {
          // Use the mainWindow variable here
          parent: mainWindow,
          modal: true,
          closable: false,
          minimizable: false,
          maximizable: false,
          resizable: false,
          width: 400,
          height: 200,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        },
        style: {
          text: {},
          detail: {},
          bar: {},
          value: { 'background-color': '#E76256' }
        }
      });

      progressBar
        .on('completed', () => {
          progressBar.detail = 'Download completed. Restarting...';
        })
        .on('aborted', (value) => {
          console.info(`Update download aborted, value ${value}`);
        })
        .on('progress', (value) => {
          progressBar.detail = `Download progress... ${Math.round(value)}%`;
        })
        .on('error', (error) => {
          dialog.showErrorBox('Update Download Error', `An error occurred while downloading the update: ${error.message}`);
        });

      autoUpdater.downloadUpdate();
    } else {
      // If "Remind me later" was clicked, set a reminder to check for updates
      if (reminderTimeout) {
        clearTimeout(reminderTimeout);
      }
      reminderTimeout = setTimeout(() => {
        autoUpdater.checkForUpdates();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  if (progressBar) {
    progressBar.value = progressObj.percent;
  }
});

autoUpdater.on('update-downloaded', () => {
  if (progressBar) {
    progressBar.setCompleted();
  }
  // Quit and install the update only if the user chose to download it
  if (userChoseToDownloadUpdate) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
});

autoUpdater.on('update-downloaded', () => {
  if (progressBar) {
    progressBar.setCompleted();
  }
  // Quit and install the update only if the user chose to download it
  if (userChoseToDownloadUpdate) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
});
app.on('before-quit', () => {
  clearInterval(updateInterval);
});

// dialog box to confirm quit
const beforeQuitListener = (e) => {
  e.preventDefault();
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Quit', 'Cancel'],
    defaultId: 0, // Set 'Cancel' as the default button
    title: 'Confirm',
    message: 'Are you sure you want to quit Peek?',
  });
  if (choice === 0) {
    app.removeListener('before-quit', beforeQuitListener);
    app.exit();
  }
};

app.on('before-quit', beforeQuitListener);
// dialog box to confirm quit

function loadPreferences() {
  const filePath = path.join(app.getPath('userData'), 'preferences.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const preferences = JSON.parse(data);
    app.setLoginItemSettings({ openAtLogin: preferences.launchAtLogin });
    return preferences;
  } catch (err) {
    console.error("Error in loadPreferences: ", err);
    // Create a default preferences.json file if it doesn't exist
    const defaultPreferences = {
      alwaysOnTop: true,
      hideDockIcon: false,
      enabledChatbots: ['openai', 'google'],
      launchAtLogin: false,
      selectedKey: 'J', // Default key
      selectedModifier: 'Cmd' // Default modifier
    };
    fs.writeFileSync(filePath, JSON.stringify(defaultPreferences, null, 2), 'utf8');
    return defaultPreferences;
  }
}

function savePreferences(preferences) {
  const filePath = path.join(app.getPath('userData'), 'preferences.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(preferences, null, 2), 'utf8');
  } catch (err) {
    console.error("Couldn't save preferences: ", err);
  }
}

let isInputFilled = false; // flag to check if input is filled
let inputWindow;


ipcMain.on('show-input-window', () => {
  inputWindow = new BrowserWindow({
    width: 400,
    height: 600,
    maxHeight: 600,
    maxWidth: 400,
    parent: mainWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      alwaysOnTop: true
    }
  });

  mainWindow.on('show', () => {
    if (inputWindow) {
      inputWindow.show();
    }
  });
  submitInput = (event, url) => {
    // Assuming 'webview-perplexity' is the id of the webview you want to update
    mainWindow.webContents.send('load-url', {webviewId: 'webview-perplexity', url: url});
    isInputFilled = true; // set the flag to true when input is submitted
    if (inputWindow) {
      inputWindow.close();
    }
  };

  ipcMain.on('submit-input', submitInput);

  inputWindow.on('close', (event) => {
    if (!isInputFilled) { // if input is not filled, prevent window from closing
      event.preventDefault();
    } else {
      ipcMain.removeListener('submit-input', submitInput);
      inputWindow.destroy(); // Destroy the BrowserWindow instance
      inputWindow = null;
    }
  });

  inputWindow.loadURL(`file://${__dirname}/UI/dialog.html`);
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('toggle-dark-mode', (event, isDarkMode) => {
  nativeTheme.themeSource = isDarkMode ? 'dark' : 'light';
  store.set('darkMode', isDarkMode);
  mainWindow.webContents.send('set-dark-mode', isDarkMode);
});

ipcMain.on('get-dark-mode', (event) => {
  const savedDarkMode = store.get('darkMode');
  const isDarkMode = savedDarkMode !== undefined ? savedDarkMode : nativeTheme.shouldUseDarkColors;
  nativeTheme.themeSource = isDarkMode ? 'dark' : 'light';
  event.reply('set-dark-mode', isDarkMode);
});