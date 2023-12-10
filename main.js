const { app, Menu, MenuItem, BrowserWindow, globalShortcut, Tray, nativeImage, ipcMain, shell } = require('electron');
const {is} = require('electron-util');
const ProgressBar = require('electron-progressbar');
const path = require('path');
const log = require('electron-log');
const url = require('url');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const Jimp = require('jimp');
const { dialog } = require('electron');
const { clipboard } = require('electron');
let mainWindow;
let tray;
let icon;
let manualUpdateCheck = false;
let reminderTimeout;
let userChoseToDownloadUpdate = false;
function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
}

function processImage(image, callback) {
  const dimensions = image.getSize();
  const padding = 65; // adjust this to change the size of the border
  const outerWidth = dimensions.width + 2 * padding;
  const outerHeight = dimensions.height + 2 * padding;

  // Create a new image with the desired background color
  new Jimp(outerWidth, outerHeight, '#E76256', (err, background) => {
    if (err) {
      console.error("Error creating background:", err);
      return;
    }

    // Read the image from the buffer
    Jimp.read(image.toPNG(), (err, img) => {
      if (err) {
        console.error("Error reading image:", err);
        return;
      }

      // Resize the image
      img.resize(dimensions.width, dimensions.height);

      // Composite the image over the background
      background.composite(img, padding, padding);

      // Get the buffer of the final image
      background.getBuffer(Jimp.MIME_PNG, (err, finalImageBuffer) => {
        if (err) {
          console.error("Error getting image buffer:", err);
          return;
        }

        callback(finalImageBuffer);
      });
    });
  });
}
async function captureAndProcessImage() {
  try {
    const image = await mainWindow.webContents.capturePage();
    const finalImageBuffer = await new Promise((resolve, reject) => {
      processImage(image, resolve);
    });
    return finalImageBuffer;
  } catch (err) {
    console.error("Error capturing page:", err);
  }
}

async function screenshotToClipboard() {
  try {
    const finalImageBuffer = await captureAndProcessImage();
    if (finalImageBuffer) {
      clipboard.writeImage(nativeImage.createFromBuffer(finalImageBuffer));
      const detail = [
        'The question is: where do you paste it?',
        'I think the screenshot looks beautiful!',
        'That is a master shot!',
        'Totally worth capturing. Paste it away!',
        'Now, where will this masterpiece end up?',
        'A moment frozen in time, ready to be pasted!',
        'Your screenshot is ready for its debut. Paste it!',
        'That\'s one for the scrapbook!',
        'A picture is worth a thousand words, and this one\'s on your clipboard!',
        'Your screenshot is ready to make its mark!',
        'That\'s a screenshot worth sharing!',
        'Your screenshot is ready to see the world!',
        'A moment captured, ready to be pasted!',
        'Your screenshot is ready for the spotlight!',
        'Your screenshot is ready to be pasted into fame!'
      ];    
      const randomDetail=detail[Math.floor(Math.random() * detail.length)];
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Peek',
        message: 'Screenshot copied to clipboard!',
        detail: randomDetail,
        buttons: ['OK'],
        icon: icon
      });
    } else {
      console.error("Failed to capture and process image");
    }
  } catch (err) {
    console.error("Error copying to clipboard:", err);
  }
}
function saveScreenshot() {
  mainWindow.webContents.capturePage().then(image => {
    processImage(image, finalImageBuffer => {
      dialog.showSaveDialog(mainWindow, {
        title: 'Save screenshot',
        defaultPath: 'screenshot.png',
        filters: [{ name: 'Images', extensions: ['png'] }]
      }).then(result => {
        if (!result.canceled) {
          fs.writeFile(result.filePath, finalImageBuffer, err => {
            if (err) console.error("Error saving file:", err);
            else console.log('Screenshot saved.');
          });
        }
      }).catch(err => console.error("Error in save dialog:", err));
    });
  }).catch(err => console.error("Error capturing page:", err));
}


function createWindow() {
  const preferences = loadPreferences();

  mainWindow = new BrowserWindow({
    width: 400,
    height: 650,
    minWidth: 450, // Set the minimum width
    minHeight: 600, // Set the minimum height
    show: false,
    frame:false,
    transparent:true,
    fullscreenable: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools:false,
    },
    alwaysOnTop: preferences.alwaysOnTop,
  });
   // Wait for the window to be ready
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

    // Show the window
    mainWindow.show();
  });
  mainWindow.on('focus', () => {
    // saved the screenshot
    globalShortcut.register('CommandOrControl+Shift+S', saveScreenshot);

    // copy the screenshot to clipboard 
    globalShortcut.register('CommandOrControl+S', screenshotToClipboard);
  });

  // unregister the shortcuts
  mainWindow.on('blur', () => {
    // When the window loses focus, unregister the shortcuts
    globalShortcut.unregister('CommandOrControl+Shift+S');
    globalShortcut.unregister('CommandOrControl+S');
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, '/UI/index.html'),
      protocol: 'file:',
      slashes: true,
    })
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let windowPosition = null;

function hideWindow() {
  windowPosition = mainWindow.getBounds();
  mainWindow.hide();
}

function showWindow() {
  if (windowPosition) {
    mainWindow.setBounds(windowPosition);
  }
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
  const iconPath = path.join(__dirname, '/icons/peek-dock.png');
  icon = nativeImage.createFromPath(iconPath);
  app.dock.setIcon(icon);

  // Create a custom menu
  const menu = new Menu();

  menu.append(new MenuItem({
    label: app.getName(),
    submenu: [
      {
        role: 'about'
      },
      {
        type: 'separator'
      },
      {
        label: 'Check for Updates...',
        click: () => {
          ipcMain.emit('check_for_update');
        }
      },
      {
        type: 'separator'
      },
      {
        role: 'hide'
      },
      {
        role: 'hideothers'
      },
      {
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        role: 'quit'
      }
    ]
  }));

  // Add the File menu
  menu.append(new MenuItem({
    label: 'File',
    submenu: [
      { role: 'close' }
    ]
  }));

  // Add the Edit menu
  menu.append(new MenuItem({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectall' },
    ]
  }));

  // Add the View menu
  menu.append(new MenuItem({
    label: 'Shortcuts',
    submenu: [
      { 
        label: 'Toggle Window', 
        accelerator: 'CmdOrCtrl+J',
        click: toggleWindow
      },
      { 
        label: 'Screenshot to Clipboard', 
        accelerator: 'CmdOrCtrl+S',
        click: screenshotToClipboard
      },
      { 
        label: 'Save Screenshot', 
        accelerator: 'CmdOrCtrl+Shift+S',
        click: saveScreenshot
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forcereload' },
      { type: 'separator' },
      { role: 'zoomin' },
      { role: 'zoomout' },
    ]
  }));

  // Add the Window menu
  menu.append(new MenuItem({
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ]
  }));

  // Add the Help menu
  menu.append(new MenuItem({
    label: 'Help',
    submenu: [
      {
        label: 'Release Notes',
        click: async () => {
          await shell.openExternal('https://github.com/prateekkeshari/peek-ai/releases');
        }
      },
     
      { type: 'separator' },
      {
        label: 'Share feedback',
        click: async () => {
          await shell.openExternal('mailto:prateekkeshari7@gmail.com?subject=Peek%20Feedback');
        }
      },
      {
        label: 'Follow on Twitter',
        click: async () => {
          await shell.openExternal('https://twitter.com/prkeshari');
        }
      },
    ]
  }));

  // Set the custom menu as the application menu
  Menu.setApplicationMenu(menu);

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

  tray = new Tray(path.join(__dirname, '/icons/peek.png'));
  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    } else if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
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
  // Quit and install the update immediately
  setImmediate(() => autoUpdater.quitAndInstall());
});

autoUpdater.on('error', (error) => {
  console.error('There was a problem updating the application');
  console.error(error);
  if (progressBar) {
    progressBar.close();
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