const { app, BrowserWindow, globalShortcut, Tray, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const url = require('url');
const { autoUpdater } = require('electron-updater');

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
  mainWindow.on('focus', () => {
    // When the window gains focus, register the Command+L shortcut
    globalShortcut.register('CommandOrControl+L', () => {
      // When the user presses Command+L, focus the URL input field
      mainWindow.webContents.executeJavaScript(`
        document.getElementById('urlInput').focus();
      `);
    });
  });
  mainWindow.on('blur', () => {
    // When the window loses focus, unregister the Command+L shortcut
    globalShortcut.unregister('CommandOrControl+L');
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
