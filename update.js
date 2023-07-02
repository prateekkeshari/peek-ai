const { autoUpdater, dialog } = require('electron-updater');
const log = require('electron-log');
const { mainWindow } = require('./window.js');

let updateDownloaded = false;
let userChoseToDownloadUpdate = false;
let reminderTimeout;

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

autoUpdater.on('update-available', (info) => {
  log.info('Update available', info);
  mainWindow.webContents.send('update_available', info.version);
});

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

autoUpdater.on('update-downloaded', () => {
  updateDownloaded = true;
  if (updateDownloaded && userChoseToDownloadUpdate) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
});

module.exports = { checkForUpdates, autoUpdater };
