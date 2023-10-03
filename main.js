const { app, Menu, MenuItem, BrowserWindow, globalShortcut, Tray, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const log = require('electron-log');
const url = require('url');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const sharp = require('sharp');
const { dialog } = require('electron');
const { clipboard } = require('electron');
const Store = require('electron-store');
const store = new Store();

// Add the ipcMain listener here
ipcMain.on('electron-store-get-data', (event, key) => {
  event.returnValue = store.get(key);
});

ipcMain.on('change-dock-icon-visibility', (event, shouldHide) => {
  console.log('Received message:', shouldHide);
  if (shouldHide) {
    app.dock.hide();
  } else {
    app.dock.show();
  }
});

let mainWindow;
let tray;
let icon;
let settingsWindow;
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
ipcMain.on('toggle-always-on-top', (event, shouldStayOnTop) => {
  console.log("Received IPC message: ", shouldStayOnTop);  // Debugging statement
  mainWindow.setAlwaysOnTop(shouldStayOnTop);
});


function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools:true,
    },
  });

  settingsWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'settings.html'),
      protocol: 'file:',
      slashes: true,
    })
  );

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function processImage(image, callback) {
  const dimensions = image.getSize();
  const padding = 65; // adjust this to change the size of the border
  const outerWidth = dimensions.width + 2 * padding;
  const outerHeight = dimensions.height + 2 * padding;

  // Create a new image with the background color
  const background = Buffer.from(
    `<svg width="${outerWidth}" height="${outerHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="Gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="10%" stop-color="#CE9FFC"/>
          <stop offset="100%" stop-color="#7367F0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${outerWidth}" height="${outerHeight}" fill="url(#Gradient1)"/>
    </svg>`
  );

  // Create a mask for rounding the corners of the screenshot
  const mask = Buffer.from(
    `<svg><rect x="0" y="0" width="${dimensions.width}" height="${dimensions.height}" rx="15" ry="15"/></svg>`
  );

  // Create a mask for rounding the corners of the border
  const borderMask = Buffer.from(
    `<svg><rect x="0" y="0" width="${outerWidth}" height="${outerHeight}" rx="12" ry="12"/></svg>`
  );

  // After saving the screenshot, round the corners and composite it on the background
  sharp(image.toPNG())
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // replace transparency with white
    .composite([{
      input: mask,
      blend: 'dest-in'
    }])
    .toBuffer()
    .then(roundedImageBuffer => {
      sharp(background)
        .composite([{
          input: borderMask,
          blend: 'dest-in'
        }, {
          input: roundedImageBuffer,
          top: padding,
          left: padding,
          blend: 'over'
        }])
        .toBuffer()
        .then(finalImageBuffer => {
          callback(finalImageBuffer);
        });
    });
}

function screenshotToClipboard() {
  // When the user presses Command+S, capture a screenshot of the webview
  mainWindow.webContents.capturePage().then(image => {
    processImage(image, finalImageBuffer => {
      // Copy the image to the clipboard
      clipboard.writeImage(nativeImage.createFromBuffer(finalImageBuffer));
      // Show a dialog box to confirm that the image has been copied
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
      console.log('Clipboard saved.');
    });
  });
}

function saveScreenshot() {
  // When the user presses Command+S, capture a screenshot of the webview
  mainWindow.webContents.capturePage().then(image => {
    processImage(image, finalImageBuffer => {
      // Save the image
      dialog.showSaveDialog(mainWindow, {
        title: 'Save screenshot',
        defaultPath: 'screenshot.png',
        filters: [{ name: 'Images', extensions: ['png'] }]
      }).then(result => {
        if (!result.canceled) {
          fs.writeFile(result.filePath, finalImageBuffer, err => {
            if (err) throw err;
            console.log('Screenshot saved.');
          });
        }
      }).catch(err => {
        console.log(err);
      });
    });
  });
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 650,
    minWidth: 450, // Set the minimum width
    minHeight: 600, // Set the minimum height
    show: false,
    frame:false,
    transparent:true,
    fullscreenable: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools:false,
    },
    alwaysOnTop: true, // floating window
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
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.webContents.toggleDevTools();
        }
      },
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

  menu.append(new MenuItem({
    label: 'File',
    submenu: [
      { role: 'close' },
      { type: 'separator' },
      {
        label: 'Preferences',
        click: createSettingsWindow,
      }
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
      { role: 'selectall' }
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
          await shell.openExternal('mailto:hi@prateek.de');
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

let updateInterval;

app.whenReady().then(() => {
  createWindow();
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

ipcMain.on('open-settings-window', () => {
  createSettingsWindow();
});
