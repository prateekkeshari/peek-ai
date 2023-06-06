window.addEventListener('DOMContentLoaded', () => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(meta);
  });
  
  const { contextBridge, ipcRenderer } = require('electron');
  
  contextBridge.exposeInMainWorld('myIpcRenderer', {
    on: (channel, callback) => {
      ipcRenderer.on(channel, callback);
    },
    send: (channel, args) => {
      ipcRenderer.send(channel, args);
    },
  });
  