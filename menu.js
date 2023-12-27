const { Menu, MenuItem, shell, app, ipcMain } = require('electron');
const { screenshotToClipboard, saveScreenshot } = require('./screenshot.js');
const { clipboard } = require('electron');


function toggleWindow(mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  }
  function createAppMenu(mainWindow, globalShortcut)  {
  const menu = new Menu();

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
        type: 'checkbox',
        checked: true,
        click: (item) => {
          if (item.checked) {
            globalShortcut.register('CmdOrCtrl+J', () => toggleWindow(mainWindow));
          } else {
            globalShortcut.unregister('CmdOrCtrl+J');
          }
        }
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

  return menu;
}

function createContextMenu(mainWindow) {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      accelerator: 'CmdOrCtrl+J', 
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          showWindow();
        }
      }
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M', 
      click: () => {
        if (mainWindow !== null) {
          mainWindow.minimize();
        }
      }
    },
    {
      label: 'Take screenshot',
      accelerator: 'CmdOrCtrl+S',
      click: screenshotToClipboard
    },
    { type: 'separator' },
    {
      label: 'Release notes',
      click: async () => {
        await shell.openExternal('https://github.com/prateekkeshari/peek-ai/releases');
      }
    },
    {
      label: 'Follow on X (Twitter)',
      click: async () => {
        await shell.openExternal('https://twitter.com/prkeshari');
      }
    },
    {
      label: 'Share feedback',
      click: async () => {
        await shell.openExternal('mailto:prateekkeshari7@gmail.com?subject=Peek%20Feedback');
      }
    },
    { type: 'separator' },
    {
      label: `Current version: ${app.getVersion()}`,
      enabled: false
    },
    {
      label: 'Check for updates...',
      click: () => {
        ipcMain.emit('check_for_update');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Peek',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        app.quit();
      }
    }
  ]);

  return contextMenu;
}

function createWebviewContextMenu(params, webContents)  {
    const contextMenu = new Menu();
  
    // Open Link in Browser
    contextMenu.append(new MenuItem({ label: 'Open Link in Browser', accelerator: 'CmdOrCtrl+O', click: () => {
      shell.openExternal(params.linkURL);
    }}));
  
    // Separator
    contextMenu.append(new MenuItem({ type: 'separator' }));
  
    // Back
    contextMenu.append(new MenuItem({ label: 'Back', accelerator: 'CmdOrCtrl+Left', click: () => webContents.goBack() }));
  
    // Forward
    contextMenu.append(new MenuItem({ label: 'Forward', accelerator: 'CmdOrCtrl+Right', click: () => webContents.goForward() }));
  
    // Reload
    contextMenu.append(new MenuItem({ label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' }));
  
    // Separator
    contextMenu.append(new MenuItem({ type: 'separator' }));
  
    // Text editing features
    if (params.selectionText) {
      contextMenu.append(new MenuItem({ label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' }));
      contextMenu.append(new MenuItem({ label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' }));
      if (clipboard.readText().length > 0) {
        contextMenu.append(new MenuItem({ label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }));
      }
      contextMenu.append(new MenuItem({ label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }));
    }
  
    // Separator
    contextMenu.append(new MenuItem({ type: 'separator' }));
  
    // Screenshot
    contextMenu.append(new MenuItem({ label: 'Take Screenshot', accelerator: 'CmdOrCtrl+Shift+S', click: () => screenshotToClipboard() }));
  
    // Share Feedback
    contextMenu.append(new MenuItem({ label: 'Share Feedback', click: () => {
      shell.openExternal('mailto:prateekkeshari7@gmail.com?subject=Peek%20Feedback');
    }}));
  
    // Release Notes
    contextMenu.append(new MenuItem({ label: 'Release Notes', click: () => {
      shell.openExternal('https://github.com/prateekkeshari/peek-ai/releases');
    }}));
  
    return contextMenu;
  }
  
  module.exports = {
    createAppMenu,
    createContextMenu,
    createWebviewContextMenu
  };
