// RP Overlay: окно поверх игры по горячей клавише. Ничего не отправляет в игру и не жмёт клавиши, только копирует текст в буфер обмена.
const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen, Tray, Menu, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');
let win, tray, file, data;

const DEFAULTS = {
  settings: { hotkey: 'F5', nick: 'Имя_Фамилия', opacity: 0.96, hideCapture: true },
  notes: 'Здесь можно хранить заметки: цены, коды, адреса, правила.\n',
  catalogs: [
    { id: 'c1', name: 'Основное', items: [
      { id: 'b1', name: 'Показать документы', trigger: '/док', desc: '', lines: ['/me достаёт документы из кармана и показывает их', '/do Паспорт в руках.', '/showpass {id}'] },
      { id: 'b2', name: 'Приветствие', trigger: '/привет', desc: '', lines: ['Здравствуйте! Чем могу помочь?'] },
      { id: 'b3', name: 'Время', trigger: '/время', desc: '', lines: ['/me смотрит на часы', '/do На часах {time}, {date}.'] }
    ] }
  ]
};
function load() {
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = null; }
  data = Object.assign({}, DEFAULTS, data || {});
  data.settings = Object.assign({}, DEFAULTS.settings, data.settings || {});
  if (Array.isArray(data.binders) && !(data.catalogs && data.catalogs.length)) { data.catalogs = [{ id: 'c1', name: 'Основное', items: data.binders }]; }
  delete data.binders;
  if (!Array.isArray(data.catalogs) || !data.catalogs.length) data.catalogs = DEFAULTS.catalogs;
}
function persist() { try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) { console.error(e); } }

function place() {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()), b = d.workArea, w = Math.min(760, b.width - 40), h = Math.min(520, b.height - 40);
  win.setBounds({ x: Math.round(b.x + (b.width - w) / 2), y: Math.round(b.y + b.height * 0.12), width: w, height: h });
}
function createWindow() {
  win = new BrowserWindow({
    width: 760, height: 520, show: false, frame: false, transparent: true, resizable: true, skipTaskbar: true, alwaysOnTop: true,
    hasShadow: false, backgroundColor: '#00000000', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setContentProtection(data.settings.hideCapture !== false);   // окно не попадает в запись экрана и скриншоты
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile('index.html');
  win.on('blur', () => { /* окно остаётся открытым, пока его не закроют F5 / Esc / Enter */ });
}
function toggle() {
  if (!win) return;
  if (win.isVisible()) { win.hide(); return; }
  place(); win.setOpacity(data.settings.opacity || 0.96); win.show(); win.focus(); win.webContents.send('shown');
}
function registerKey(k) {
  globalShortcut.unregisterAll();
  let ok = false;
  try { ok = globalShortcut.register(k, toggle); } catch (e) { ok = false; }
  if (!ok) { win && win.webContents.send('hotkey-error', k); try { globalShortcut.register(data.settings.hotkey, toggle); } catch (e) { } }
  return ok;
}
app.whenReady().then(() => {
  file = path.join(app.getPath('userData'), 'rp-overlay.json'); load(); createWindow();
  registerKey(data.settings.hotkey);
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }));
    tray.setToolTip('RP Overlay — ' + data.settings.hotkey);
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Показать / скрыть', click: toggle }, { type: 'separator' }, { label: 'Выход', click: () => app.quit() }]));
    tray.on('click', toggle);
  } catch (e) { }
});
ipcMain.handle('load', () => data);
ipcMain.on('save', (_, d) => { data = d; persist(); if (win) { win.setOpacity(data.settings.opacity || 0.96); win.setContentProtection(data.settings.hideCapture !== false); } });
ipcMain.on('copy', (_, t) => clipboard.writeText(String(t)));
ipcMain.on('hide', () => win && win.hide());
ipcMain.on('quit', () => app.quit());
ipcMain.handle('hotkey', (_, k) => { const old = data.settings.hotkey; const ok = registerKey(k); if (ok) { data.settings.hotkey = k; persist(); if (tray) tray.setToolTip('RP Overlay — ' + k); } else registerKey(old); return ok; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', e => e.preventDefault());
const lock = app.requestSingleInstanceLock(); if (!lock) app.quit(); else app.on('second-instance', toggle);
