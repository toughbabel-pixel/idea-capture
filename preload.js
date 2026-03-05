const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ideaAPI', {
  saveIdea: (payload) => ipcRenderer.invoke('save-idea', payload),
  getIdeasData: () => ipcRenderer.invoke('get-ideas-data'),
  deleteIdea: (id) => ipcRenderer.invoke('delete-idea', id),
  togglePin: (id) => ipcRenderer.invoke('toggle-pin', id),
  setDarkMode: (enabled) => ipcRenderer.invoke('set-dark-mode', enabled),
  openHistoryWindow: () => ipcRenderer.invoke('open-history-window'),
  closeCaptureWindow: () => ipcRenderer.invoke('close-capture-window'),
  exportMarkdown: () => ipcRenderer.invoke('export-markdown'),
  onFocusInput: (listener) => ipcRenderer.on('focus-input', listener),
  onHistoryRefresh: (listener) => ipcRenderer.on('history-refresh', listener)
});
