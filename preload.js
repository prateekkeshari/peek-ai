window.addEventListener('DOMContentLoaded', () => {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1';
  document.head.appendChild(meta);
  document.body.style.backgroundColor = '#343541';
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
contextBridge.exposeInMainWorld('myIpcRenderer', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});
