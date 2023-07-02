const { Menu, MenuItem, app, shell } = require('electron');
const { toggleWindow, screenshotToClipboard, saveScreenshot } = require('./window.js');
const { checkForUpdates } = require('./update.js');

function createMenu() {
  // Set the app name
  app.setName('Peek');

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
          checkForUpdates();
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
      { role: 'toggleDevTools'},
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
}

module.exports = { createMenu };
