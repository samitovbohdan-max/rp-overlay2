const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  save: d => ipcRenderer.send('save', d),
  copy: t => ipcRenderer.send('copy', t),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
  setHotkey: k => ipcRenderer.invoke('hotkey', k),
  onShow: f => ipcRenderer.on('shown', () => f()),
  onHotkeyError: f => ipcRenderer.on('hotkey-error', (_, k) => f(k))
});
