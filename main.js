const { app, BrowserWindow, globalShortcut, Tray, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const sharp = require('sharp');
const { dialog } = require('electron');
const { clipboard } = require('electron');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 650,
    minWidth: 450, // Set the minimum width
    minHeight: 600, // Set the minimum height
    maxWidth: 800, // Set the maximum width
    maxHeight: 1000, // Set the maximum height
    show: true,
    frame:false,
    transparent:true,
    fullscreenable: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    alwaysOnTop: true, // floating window

  });
  function processImage(image, callback) {
    const dimensions = image.getSize();
    const padding = 60; // adjust this to change the size of the border
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
  mainWindow.on('focus', () => {

    // Link selector, register the Command+L shortcut
    globalShortcut.register('CommandOrControl+L', () => {
      // When the user presses Command+L, focus the URL input field
      mainWindow.webContents.executeJavaScript(`
        document.getElementById('urlInput').focus();
      `);
    });
    // saved the screenshot
    globalShortcut.register('CommandOrControl+Shift+S', () => {
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
    });

    // copy the screenshot to clipboard 
    globalShortcut.register('CommandOrControl+S', () => {
      // When the user presses Command+S, capture a screenshot of the webview
      mainWindow.webContents.capturePage().then(image => {
        processImage(image, finalImageBuffer => {
         // Copy the image to the clipboard
    clipboard.writeImage(nativeImage.createFromBuffer(finalImageBuffer));
    // Show a dialog box to confirm that the image has been copied
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Peek',
      message: 'Image copied to clipboard 📸',
      buttons: ['OK']
    });
    console.log('Clipboard saved.');
    });
    });
    });

  });
   // unregister the shortcuts
  mainWindow.on('blur', () => {
    // When the window loses focus, unregister the shortcuts
    globalShortcut.unregister('CommandOrControl+L');
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
  const appIconPath = path.join(__dirname, 'peek-dock.png');
  const image = nativeImage.createFromPath(appIconPath);
  app.dock.setIcon(image);
});

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
  tray = new Tray(path.join(__dirname, 'peek.png'));
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });

  // Register the Command+L global shortcut
  globalShortcut.register('CommandOrControl+L', () => {
    // When the user presses Command+L, focus the URL input field
    mainWindow.webContents.executeJavaScript(`
      document.getElementById('urlInput').focus();
    `);
  });
// Register the Command+S global shortcut for screenshot



  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update_available');
  });
  
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update_downloaded');
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.on('ipc-message', (event, channel) => {
      if (channel === 'restart_app') {
        autoUpdater.quitAndInstall();
      }
    });
  });
  // Register the global shortcut
globalShortcut.register('CmdOrCtrl+J', () => {
  if (mainWindow.isVisible()) {
    mainWindow.hide(); // Hide the app window when the shortcut is pressed again
  } else {
    showWindow();
  }
});

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Unregister the global shortcut
  globalShortcut.unregisterAll();
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});
