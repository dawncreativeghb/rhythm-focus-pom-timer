// Rhythm Focus desktop widget — a small, always-on-top window that loads the
// live web app, so it always stays current and has full controls, music, and
// cross-device sync (sign in inside the window to sync with your other devices).

const { app, BrowserWindow, shell, screen } = require('electron');

const APP_URL = 'https://rhythm-focus-pom-timer.lovable.app';

function createWindow() {
  // Open pinned to the top-left of the screen (below the menu bar), like the
  // macOS Calendar/Weather widgets. You can still drag it anywhere afterward.
  const { workArea } = screen.getPrimaryDisplay();
  const MARGIN = 16;

  const win = new BrowserWindow({
    width: 380,
    height: 680,
    x: workArea.x + MARGIN,
    y: workArea.y + MARGIN,
    minWidth: 300,
    minHeight: 460,
    alwaysOnTop: true,
    fullscreenable: false,
    maximizable: false,
    title: 'Rhythm Focus',
    backgroundColor: '#0e1a2b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Float above normal windows (incl. most full-screen apps on macOS).
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadURL(APP_URL);

  // Any window.open() (rare) goes to the user's real browser, not a popup.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
