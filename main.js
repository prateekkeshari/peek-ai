const { app, Menu, MenuItem, BrowserWindow, globalShortcut, Tray, nativeImage, ipcMain, shell, screen } = require('electron');
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

console.log('Current version:', currentVersion);
console.log('Last version:', store.get('version'));

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
  const preferences = loadPreferences();

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

  mainWindow.loadURL('about:blank');
   mainWindow.once('ready-to-show', () => {
     // Get the bounds of the tray icon
     const trayBounds = tray.getBounds();
   
     // Calculate the window position
     const windowPosition = {
       x: Math.round(trayBounds.x + (trayBounds.width / 2) - (mainWindow.getBounds().width / 2)),
       y: Math.round(trayBounds.y + trayBounds.height)
     };
   
     // Set the window position
     mainWindow.setPosition(windowPosition.x, windowPosition.y, false);
   
     const appMenu = createAppMenu(mainWindow);
     Menu.setApplicationMenu(appMenu);
     const menu = createAppMenu(mainWindow, globalShortcut);
     Menu.setApplicationMenu(menu);
    
    
    mainWindow.show();
  });
  // Pass 'webContents' to 'createWebviewContextMenu' when calling it
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.on('context-menu', (e, params) => {
      const webviewContextMenu = createWebviewContextMenu(params, webContents, mainWindow);
      webviewContextMenu.popup(webContents.getOwnerBrowserWindow());
    });
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  setMainWindow(mainWindow);
  setIcon(icon);
}

let windowPosition = null;

function hideWindow() {
  windowPosition = mainWindow.getBounds();
  mainWindow.hide();
}

function showWindow() {
  // Get the current mouse cursor position
  const cursorPosition = screen.getCursorScreenPoint();

  // Calculate the window position based on the current mouse position
  const windowPosition = {
    x: Math.round(cursorPosition.x - (mainWindow.getBounds().width / 2)),
    y: Math.round(cursorPosition.y)
  };

  // Set the window position
  mainWindow.setPosition(windowPosition.x, windowPosition.y, false);

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

app.on('ready', () => {
  // Set the app name
  app.setName('Peek');
  const preferences = loadPreferences();
if (preferences.hideDockIcon) {
  app.dock.hide();
}

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
  // Load preferences from a file or default values
  const preferences = loadPreferences();
  event.sender.send('load-preferences', preferences);
});
ipcMain.on('save-preferences', (event, preferences) => {
  // Save preferences to a file
  savePreferences(preferences);

  // Update "Always On Top" setting
  if(preferences.alwaysOnTop !== undefined) {
    mainWindow.setAlwaysOnTop(preferences.alwaysOnTop);
  }

  // Update "Hide Dock Icon" setting (macOS only)
  if(preferences.hideDockIcon !== undefined) {
    if(preferences.hideDockIcon) {
      app.dock.hide();
    } else {
      app.dock.show();
    }
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

  // Use the createContextMenu function to create the context menu
  const contextMenu = createContextMenu(mainWindow);
  
  tray = new Tray(path.join(__dirname, '/icons/peek-menu-bar.png'));
  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });

  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      // Get the bounds of the tray icon
      const trayBounds = tray.getBounds();
  
      // Calculate the window position
      const windowPosition = {
        x: Math.round(trayBounds.x + (trayBounds.width / 2) - (mainWindow.getBounds().width / 2)),
        y: Math.round(trayBounds.y + trayBounds.height)
      };
  
      // Set the window position
      mainWindow.setPosition(windowPosition.x, windowPosition.y, false);
  
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.on('ipc-message', (event, channel) => {
      if (channel === 'restart_app') {
        autoUpdater.quitAndInstall();
      }
    });
  });
  // Register the global shortcut
// Use the toggleWindow function in the globalShortcut.register call
globalShortcut.register('CmdOrCtrl+J', toggleWindow);
// Register the global shortcut
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
            nodeIntegration: true,
            contextIsolation: false
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

function loadPreferences() {
  const filePath = path.join(app.getPath('userData'), 'preferences.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const preferences = JSON.parse(data);
    app.setLoginItemSettings({ openAtLogin: preferences.launchAtLogin });
    return preferences;
  } catch (err) {
    return {
      alwaysOnTop: true,
      hideDockIcon: false,
      enabledChatbots: ['openai', 'google'],
      launchAtLogin: false
    };
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