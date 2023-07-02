const { Tray } = require('electron');
const path = require('path');
const { createWindow, hideWindow, showWindow } = require('./window.js');

let tray;

function createTray() {
  tray = new Tray(path.join(__dirname, '/icons/peek.png'));
  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    } else if (mainWindow.isVisible()) {
      hideWindow();
    } else {
      showWindow();
    }
  });
}

module.exports = { createTray };
