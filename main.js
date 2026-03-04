const { app, BrowserWindow, globalShortcut, ipcMain, screen, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let historyWindow;

const dataDir = app.getPath('userData');
const dataFile = path.join(dataDir, 'ideas.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    const seed = {
      ideas: [],
      dailyCounts: {},
      darkMode: false
    };

    fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2), 'utf-8');
  }
}

function readIdeasData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(dataFile, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      ideas: [],
      dailyCounts: {},
      darkMode: false
    };
  }
}

function writeIdeasData(data) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
}

function positionAndShowCaptureWindow() {
  if (!mainWindow) return;

  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const bounds = mainWindow.getBounds();

  const x = Math.round((width - bounds.width) / 2);
  const y = Math.round((height - bounds.height) / 2);

  mainWindow.setPosition(x, y);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('focus-input');
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 430,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('blur', () => {
    if (!historyWindow || historyWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });
}

function createHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    historyWindow.webContents.send('history-refresh');
    return;
  }

  historyWindow = new BrowserWindow({
    width: 860,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    title: 'Idea History',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  historyWindow.loadFile('history.html');
  historyWindow.on('closed', () => {
    historyWindow = null;
  });
}

app.whenReady().then(() => {
  ensureDataFile();
  createMainWindow();

  const registered = globalShortcut.register('CommandOrControl+Space', () => {
    positionAndShowCaptureWindow();
  });

  if (!registered) {
    dialog.showErrorBox('Shortcut registration failed', 'Unable to register Ctrl + Space global shortcut.');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('save-idea', async (_, payload) => {
  const data = readIdeasData();
  const text = payload?.text?.trim();

  if (!text) {
    return { ok: false, message: 'Idea text cannot be empty.' };
  }

  const createdAt = new Date().toISOString();
  const dateKey = createdAt.slice(0, 10);
  const tags = (text.match(/#[\w-]+/g) || []).map((t) => t.toLowerCase());

  const idea = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    tags,
    pinned: false,
    createdAt
  };

  data.ideas.unshift(idea);
  data.dailyCounts[dateKey] = (data.dailyCounts[dateKey] || 0) + 1;

  writeIdeasData(data);

  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('history-refresh');
  }

  return { ok: true, idea, dailyCount: data.dailyCounts[dateKey] };
});

ipcMain.handle('get-ideas-data', async () => readIdeasData());

ipcMain.handle('delete-idea', async (_, id) => {
  const data = readIdeasData();
  const before = data.ideas.length;
  data.ideas = data.ideas.filter((idea) => idea.id !== id);

  if (data.ideas.length !== before) {
    writeIdeasData(data);
    return { ok: true };
  }

  return { ok: false, message: 'Idea not found.' };
});

ipcMain.handle('toggle-pin', async (_, id) => {
  const data = readIdeasData();
  const idea = data.ideas.find((item) => item.id === id);

  if (!idea) {
    return { ok: false, message: 'Idea not found.' };
  }

  idea.pinned = !idea.pinned;
  writeIdeasData(data);
  return { ok: true, pinned: idea.pinned };
});

ipcMain.handle('set-dark-mode', async (_, enabled) => {
  const data = readIdeasData();
  data.darkMode = Boolean(enabled);
  writeIdeasData(data);
  return { ok: true };
});

ipcMain.handle('open-history-window', async () => {
  createHistoryWindow();
  return { ok: true };
});

ipcMain.handle('close-capture-window', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }

  return { ok: true };
});

ipcMain.handle('export-markdown', async () => {
  const data = readIdeasData();
  const defaultPath = path.join(app.getPath('documents'), `ideas-export-${new Date().toISOString().slice(0, 10)}.md`);

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Ideas to Markdown',
    defaultPath,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });

  if (canceled || !filePath) {
    return { ok: false, message: 'Export canceled.' };
  }

  const lines = ['# Idea Export', ''];

  data.ideas.forEach((idea, index) => {
    lines.push(`## ${index + 1}. ${new Date(idea.createdAt).toLocaleString()}`);
    lines.push('');
    lines.push(idea.text);
    lines.push('');
    if (idea.tags.length) {
      lines.push(`Tags: ${idea.tags.join(', ')}`);
      lines.push('');
    }
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  return { ok: true, filePath };
});
