const { 
  app, 
  nativeTheme, 
  Menu, 
  MenuItem, 
  BrowserWindow, 
  globalShortcut, 
  Tray, 
  nativeImage, 
  ipcMain, 
  shell, 
  screen, 
  systemPreferences 
} = require('electron');
const { 
  processImage, 
  captureAndProcessImage, 
  screenshotToClipboard, 
  saveScreenshot, 
  setMainWindow, 
  setIcon 
} = require('./screenshot.js');
const { createAppMenu, createContextMenu, createWebviewContextMenu } = require('./menu.js');
const { is } = require('electron-util');
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

let currentWebviewKey = 'openai';
let activeWebviewKeys = [];
let forceQuit = false;
let updateInProgress = false;
let downloadCancelled = false;
let downloadRetryCount = 0;
let updateDownloadStartTime;
let progressBar;

// keep these near top
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const UPDATE_REMINDER_DELAY = 4 * 60 * 60 * 1000;  // 4 hours
const MAX_DOWNLOAD_RETRIES = 3;
const isDev = process.env.NODE_ENV === 'development';
const UPDATE_RETRY_DELAY = 3000; // 3 seconds

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

if (isDev) {
  autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');
} else {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'prateekkeshari',
    repo: 'peek-ai',
    private: false,
  });
}

ipcMain.on('active-webview-keys', (event, keys) => {
  activeWebviewKeys = keys;
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

/* --------------------------------------------------------------------------------
 * createWindow
 * --------------------------------------------------------------------------------*/
function createWindow() {
  let preferences = loadPreferences();

  mainWindow = new BrowserWindow({
    width: 450,
    height: 700,
    minWidth: 450, 
    minHeight: 500,
    show: false,
    frame: false,
    transparent: true,
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

  // re-load preferences (just to ensure consistency)
  preferences = store.get('preferences');
  mainWindow.webContents.send('load-preferences', preferences);
  mainWindow.loadURL('about:blank');

  // show the menu after ready-to-show
  mainWindow.once('ready-to-show', () => {
    const appMenu = createAppMenu(mainWindow);
    Menu.setApplicationMenu(appMenu);
    const menu = createAppMenu(mainWindow, globalShortcut);
    Menu.setApplicationMenu(menu);
    mainWindow.show();
  });

  // pass 'webContents' to 'createWebviewContextMenu' when calling it
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    // enable permissions for the webview
    webContents.session.setPermissionRequestHandler(async (wc, permission, callback) => {
      if (permission === 'media') {
        if (process.platform === 'darwin') {
          const status = systemPreferences.getMediaAccessStatus('microphone');
          if (status === 'not-determined') {
            try {
              const granted = await systemPreferences.askForMediaAccess('microphone');
              callback(granted);
            } catch (err) {
              console.error('Error requesting microphone permission:', err);
              callback(false);
            }
          } else {
            callback(status === 'granted');
          }
        } else {
          callback(true);
        }
      } else {
        callback(true);
      }
    });

    // set up media device permissions check
    webContents.session.setPermissionCheckHandler((wc, permission) => {
      if (permission === 'media') {
        return process.platform === 'darwin' 
          ? systemPreferences.getMediaAccessStatus('microphone') === 'granted'
          : true;
      }
      return true;
    });

    // for macOS, handle bluetooth
    if (process.platform === 'darwin') {
      webContents.on('select-bluetooth-device', (event, devices, callback) => {
        event.preventDefault();
      });
      webContents.session.setPermissionCheckHandler((wc, permission) => {
        if (permission === 'media') {
          return systemPreferences.getMediaAccessStatus('microphone') === 'granted';
        }
        return true;
      });
    }

    // context menu for webview
    webContents.on('context-menu', (e, params) => {
      const webviewContextMenu = createWebviewContextMenu(params, webContents, mainWindow);
      webviewContextMenu.popup(webContents.getOwnerBrowserWindow());
    });
  });

  // screen wake lock
  mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(true);
    }
  });

  // global shortcut on focus
  mainWindow.on('focus', () => {
    globalShortcut.register('CommandOrControl+Shift+S', saveScreenshot);
    globalShortcut.register('CommandOrControl+S', screenshotToClipboard);

    globalShortcut.register('Cmd+Ctrl+Right', () => {
      const newIndex = (activeWebviewKeys.indexOf(currentWebviewKey) + 1) % activeWebviewKeys.length;
      currentWebviewKey = activeWebviewKeys[newIndex];
      mainWindow.webContents.send('switch-webview', currentWebviewKey);
    });

    globalShortcut.register('Cmd+Ctrl+Left', () => {
      const newIndex = (activeWebviewKeys.indexOf(currentWebviewKey) - 1 + activeWebviewKeys.length) % activeWebviewKeys.length;
      currentWebviewKey = activeWebviewKeys[newIndex];
      mainWindow.webContents.send('switch-webview', currentWebviewKey);
    });
  });

  // unregister shortcuts on blur
  mainWindow.on('blur', () => {
    globalShortcut.unregister('CommandOrControl+Shift+S');
    globalShortcut.unregister('CommandOrControl+S');
    globalShortcut.unregister('Cmd+Ctrl+Right');
    globalShortcut.unregister('Cmd+Ctrl+Left');
  });

  // override close => hide, unless forceQuit
  mainWindow.on('close', (event) => {
    if (!forceQuit) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  setMainWindow(mainWindow);
  setIcon(icon);

  // load saved dark mode preference
  const savedDarkMode = store.get('darkMode');
  if (savedDarkMode !== undefined) {
    nativeTheme.themeSource = savedDarkMode ? 'dark' : 'light';
  }

  // initialize theme
  const savedTheme = store.get('theme', 'system');
  setTheme(savedTheme);
}

/* --------------------------------------------------------------------------------
 * hide/show window helpers
 * --------------------------------------------------------------------------------*/
let windowPosition = null;

function hideWindow() {
  windowPosition = mainWindow.getBounds();
  mainWindow.hide();
}

function showWindow() {
  if (windowPosition) {
    mainWindow.setBounds(windowPosition, false);
  }
  mainWindow.show();
}

/* --------------------------------------------------------------------------------
 * toggle window for global shortcut
 * --------------------------------------------------------------------------------*/
function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
}

/* --------------------------------------------------------------------------------
 * registerShortcut
 * --------------------------------------------------------------------------------*/
function registerShortcut(preferences) {
  if (preferences.selectedKey && preferences.selectedModifier) {
    const shortcut = `${preferences.selectedModifier}+${preferences.selectedKey}`;
    globalShortcut.register(shortcut, toggleWindow);
  }
}

/* --------------------------------------------------------------------------------
 * app.whenReady() -> unify all the old 'ready' logic
 * --------------------------------------------------------------------------------*/
app.whenReady().then(() => {
  // set name
  app.setName('Peek');

  // load preferences
  let preferences = loadPreferences();
  if (preferences.hideDockIcon) {
    app.dock.hide();
  }

  // register custom shortcut
  registerShortcut(preferences);

  // set the Dock icon
  const iconPath = path.join(__dirname, '/icons/peek-dock-icon.png');
  icon = nativeImage.createFromPath(iconPath);
  app.dock.setIcon(icon);

  // actually create the main window
  createWindow();

  // set up the tray icon after window creation
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
  setTrayIcon();

  // tray right click -> contextMenu
  const contextMenu = createContextMenu(mainWindow);
  if (tray) {
    tray.on('right-click', () => {
      tray.popUpContextMenu(contextMenu);
    });

    let isWindowVisible = true;
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

  // update tray icon on OS theme change
  nativeTheme.on('updated', () => {
    setTrayIcon();
  });

  // check for updates when user requests
  ipcMain.on('check_for_update', () => {
    manualUpdateCheck = true;
    autoUpdater.checkForUpdates();
  });

  // explicitly set auto download/install preferences
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // first-run or version check -> decide which page to show
  const currentVersion = app.getVersion();
  let lastVersion = store.get('version');
  let hasRunBefore = store.get('hasRunBefore');
  let pageToLoad;

  if (!hasRunBefore || !lastVersion || lastVersion !== currentVersion) {
    store.set('hasRunBefore', true);
    store.set('version', currentVersion);
    pageToLoad = `file://${__dirname}/UI/onboarding.html`;
  } else {
    pageToLoad = `file://${__dirname}/UI/index.html`;
  }

  mainWindow.loadURL(pageToLoad);

  // prompt to move app to /Applications on mac
  if (is.macos && !app.isInApplicationsFolder()) {
    const choice = dialog.showMessageBoxSync({
      type: 'question',
      buttons: ['Move to Applications Folder', 'Do Not Move'],
      defaultId: 0,
      message:
        'To receive future updates, move this to the Applications folder. You can safely delete the file from the downloaded folder after moving.'
    });
    if (choice === 0) {
      try {
        app.moveToApplicationsFolder();
      } catch {
        console.error('Failed to move app to Applications folder.');
      }
    }
  }

  // begin update check
  autoUpdater.checkForUpdates();
  autoUpdater.autoInstallOnAppQuit = false;

  // check for updates periodically (24h)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 24 * 60 * 60 * 1000);

  // handle the 'ipc-message' for app restarts
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.on('ipc-message', (event, channel) => {
      if (channel === 'restart_app') {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // network / download interruptions
  mainWindow.webContents.session.on('will-download', (event, item) => {
    if (item.getURL().includes('update')) {
      item.on('done', (event, state) => {
        if (state === 'interrupted') {
          log.warn('Download interrupted, will retry when network is available');
          retryUpdate();
        }
      });
    }
  });

  // Check for pending updates on app start
  const pendingUpdate = store.get('pendingUpdate');
  if (pendingUpdate) {
    const hoursSinceUpdate = (Date.now() - pendingUpdate.timestamp) / (1000 * 60 * 60);
    if (hoursSinceUpdate < 24) { // Show reminder if within 24 hours
      dialog.showMessageBox({
        type: 'info',
        message: `A new version (${pendingUpdate.version}) is available`,
        buttons: ['Install Now', 'Later'],
        defaultId: 0
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.checkForUpdates();
        }
      });
    }
    // Clear old pending updates
    store.delete('pendingUpdate');
  }
});

/* --------------------------------------------------------------------------------
 * preferences ipc
 * --------------------------------------------------------------------------------*/
ipcMain.on('request-preferences', (event) => {
  const preferences = loadPreferences();
  mainWindow.webContents.send('load-preferences', preferences);
});

ipcMain.on('save-preferences', (event, updatedPreferences) => {
  // Save to disk
  savePreferences(updatedPreferences);

  // alwaysOnTop
  if (updatedPreferences.alwaysOnTop !== undefined) {
    mainWindow.setAlwaysOnTop(updatedPreferences.alwaysOnTop);
  }

  // hideDockIcon
  if (updatedPreferences.hideDockIcon !== undefined) {
    if (updatedPreferences.hideDockIcon) {
      app.dock.hide();
    } else {
      app.dock.show();
    }
  }

  // launchAtLogin
  if (updatedPreferences.launchAtLogin !== undefined) {
    app.setLoginItemSettings({ openAtLogin: updatedPreferences.launchAtLogin });
  }

  // selectedKey & selectedModifier
  if (
    updatedPreferences.selectedKey !== undefined &&
    updatedPreferences.selectedModifier !== undefined
  ) {
    const newShortcut = `${updatedPreferences.selectedModifier}+${updatedPreferences.selectedKey}`;
    globalShortcut.unregisterAll();
    globalShortcut.register(newShortcut, toggleWindow);
  }

  // enabledChatbots (placeholder)
  if (updatedPreferences.enabledChatbots !== undefined) {
    // ...
  }
});

/* --------------------------------------------------------------------------------
 * app event(s)
 * --------------------------------------------------------------------------------*/
app.on('web-contents-created', (webContentsCreatedEvent, contents) => {
  if (contents.getType() === 'webview') {
    contents.on('new-window', (newWindowEvent, theURL) => {
      newWindowEvent.preventDefault();
      shell.openExternal(theURL);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// typical macOS behavior
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  forceQuit = true;
});

// so we can cleanup
app.on('will-quit', () => {
  try {
    if (progressBar) progressBar.close();
    if (reminderTimeout) clearTimeout(reminderTimeout);
    globalShortcut.unregisterAll();
  } catch (error) {
    log.error('Cleanup error:', error);
  }
});

/* --------------------------------------------------------------------------------
 * autoUpdater - events
 * --------------------------------------------------------------------------------*/
autoUpdater.on('update-available', async (info) => {
  log.info('Update available:', info.version);
  
  // Don't show dialog if update is already in progress
  if (updateInProgress) return;
  updateInProgress = true;

  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Update available ⚡',
    message: `A new version (${info.version}) of Peek is available.`,
    buttons: ['Install & Restart', 'Later'],
    defaultId: 0
  });

  if (result.response === 0) {
    try {
      if (progressBar) progressBar.close();
      
      progressBar = new ProgressBar({
        indeterminate: false,
        title: 'Downloading Update',
        text: 'Preparing download...',
        browserWindow: {
          parent: mainWindow,
          modal: true,
          closable: false,
          width: 450,
          height: 170
        }
      });

      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Download error:', error);
      updateInProgress = false;
      if (progressBar) progressBar.close();
      dialog.showErrorBox('Update Error', 'Failed to start download. Please try again later.');
    }
  } else {
    // User chose Later
    updateInProgress = false;
    store.set('lastUpdateCheck', Date.now());
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (!progressBar || progressBar.isCompleted()) return;
  
  try {
    const percent = Math.round(progressObj.percent);
    progressBar.value = percent;
    
    const downloadedMB = (progressObj.transferred / 1048576).toFixed(1);
    const totalMB = (progressObj.total / 1048576).toFixed(1);
    const speed = (progressObj.bytesPerSecond / 1048576).toFixed(1);
    
    progressBar.detail = `Downloaded: ${downloadedMB}MB of ${totalMB}MB (${speed}MB/s)`;
  } catch (error) {
    log.error('Progress update error:', error);
  }
});

autoUpdater.on('update-downloaded', () => {
  log.info('Update downloaded, preparing to install');
  
  try {
    if (progressBar) {
      progressBar.setCompleted();
      progressBar.close();
    }

    // Cleanup and quit
    forceQuit = true;
    
    if (tray) {
      tray.destroy();
      tray = null;
    }

    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    });

    // Remove all listeners that might prevent quit
    app.removeAllListeners('window-all-closed');
    app.removeAllListeners('before-quit');
    app.removeAllListeners('will-quit');
    autoUpdater.removeAllListeners();

    // Force quit and install
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        log.error('Final quit error:', err);
        process.exit(0);
      }
    });
  } catch (error) {
    log.error('Update installation error:', error);
    process.exit(1);
  }
});

autoUpdater.on('error', (error) => {
  log.error('Update error:', error);
  
  if (progressBar) progressBar.close();
  updateInProgress = false;

  // Don't show error for dev environment missing update config
  if (isDev && error.message.includes('dev-app-update.yml')) return;

  if (downloadRetryCount < MAX_DOWNLOAD_RETRIES) {
    downloadRetryCount++;
    log.info(`Retrying download (attempt ${downloadRetryCount}/${MAX_DOWNLOAD_RETRIES})`);
    setTimeout(() => autoUpdater.downloadUpdate(), UPDATE_RETRY_DELAY);
  } else {
    dialog.showErrorBox(
      'Update Error',
      'Failed to download update after multiple attempts. Please check your internet connection and try again later.'
    );
    downloadRetryCount = 0;
  }
});

/* --------------------------------------------------------------------------------
 * input window
 * --------------------------------------------------------------------------------*/
let isInputFilled = false;
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

  const submitInput = (event, url) => {
    mainWindow.webContents.send('load-url', { webviewId: 'webview-perplexity', url: url });
    isInputFilled = true;
    if (inputWindow) {
      inputWindow.close();
    }
  };

  ipcMain.on('submit-input', submitInput);

  inputWindow.on('close', (event) => {
    if (!isInputFilled) {
      event.preventDefault();
    } else {
      ipcMain.removeListener('submit-input', submitInput);
      inputWindow.destroy();
      inputWindow = null;
    }
  });

  inputWindow.loadURL(`file://${__dirname}/UI/dialog.html`);
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

/* --------------------------------------------------------------------------------
 * theme
 * --------------------------------------------------------------------------------*/
function setTheme(theme) {
  nativeTheme.themeSource = theme;
  store.set('theme', theme);
  if (mainWindow) {
    mainWindow.webContents.send('set-theme', theme);
  }
}

ipcMain.on('set-theme', (event, theme) => {
  setTheme(theme);
});

ipcMain.on('get-theme', (event) => {
  const savedTheme = store.get('theme', 'system');
  setTheme(savedTheme);
});

nativeTheme.on('updated', () => {
  const currentTheme = store.get('theme', 'system');
  if (currentTheme === 'system') {
    mainWindow.webContents.send('set-theme', 'system');
  }
});

/* --------------------------------------------------------------------------------
 * load/save preferences
 * --------------------------------------------------------------------------------*/
function loadPreferences() {
  const filePath = path.join(app.getPath('userData'), 'preferences.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const preferences = JSON.parse(data);
    app.setLoginItemSettings({ openAtLogin: preferences.launchAtLogin });
    if (preferences.theme) {
      nativeTheme.themeSource = preferences.theme;
    }
    return preferences;
  } catch (err) {
    console.error("Error in loadPreferences: ", err);
    return {
      alwaysOnTop: true,
      hideDockIcon: false,
      enabledChatbots: ['openai', 'google'],
      launchAtLogin: false,
      selectedKey: 'J',
      selectedModifier: 'Cmd',
      theme: 'system'
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

/* --------------------------------------------------------------------------------
 * retryUpdate (for any lost connections, etc.)
 * --------------------------------------------------------------------------------*/
function retryUpdate() {
  if (downloadRetryCount < MAX_DOWNLOAD_RETRIES) {
    downloadRetryCount++;
    log.warn(`Retrying update download (attempt #${downloadRetryCount})...`);
    setTimeout(() => {
      autoUpdater.downloadUpdate().catch((error) => {
        log.error('Retry downloadUpdate error:', error);
      });
    }, 3000);
  } else {
    log.error('Max update download retries reached.');
  }
}

// Add these handlers to ensure we catch any quit-related issues
app.on('before-quit', (event) => {
  log.info('before-quit triggered');
  forceQuit = true;
});

app.on('will-quit', (event) => {
  log.info('will-quit triggered');
  // Clean up any remaining resources
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('quit', (event, exitCode) => {
  log.info('quit triggered with exit code:', exitCode);
});