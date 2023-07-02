const { app, globalShortcut, ipcMain } = require('electron');
const { createWindow, hideWindow, showWindow } = require('./window.js');
const { screenshotToClipboard, saveScreenshot } = require('./screenshot.js');
const { checkForUpdates, autoUpdater } = require('./update.js');
const { createMenu } = require('./menu.js');
const { createTray } = require('./tray.js');

let manualUpdateCheck = false;
let reminderTimeout;
let userChoseToDownloadUpdate = false;
let updateInterval;

app.whenReady().then(() => {
  createWindow();
  checkForUpdates();

  // Set autoInstallOnAppQuit to true to apply updates silently
  autoUpdater.autoInstallOnAppQuit = false;

  // Check for updates every 24 hours
  updateInterval = setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 24 * 60 * 60 * 1000);

  createTray();
  createMenu();

  // Register the global shortcut
  globalShortcut.register('CmdOrCtrl+J', () => {
    if (mainWindow.isVisible()) {
      hideWindow();
    } else {
      showWindow();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+S', saveScreenshot);
  globalShortcut.register('CommandOrControl+S', screenshotToClipboard);
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

ipcMain.on('check_for_update', () => {
  manualUpdateCheck = true;
  autoUpdater.checkForUpdates();
});

autoUpdater.on('update-available', (info) => {
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

let updateDownloaded = false;
autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update available ⚡',
    message: `Hello there! A new version (${info.version}) of Peek is available.`,
    buttons: ['Remind me later', 'Install & Restart']
  }).then((result) => {
    if (result.response === 1) {
      userChoseToDownloadUpdate = true;
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

autoUpdater.on('update-downloaded', () => {
  updateDownloaded = true;
  if (updateDownloaded && userChoseToDownloadUpdate) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
});

app.on('before-quit', () => {
  clearInterval(updateInterval);
});
