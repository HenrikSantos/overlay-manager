import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  Notification,
} from "electron";
import Store from "electron-store";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OverlayManager {
  constructor() {
    this.overlays = [];
    this.controlWindow = null;
    this.tray = null;
    this.store = new Store();
    this.isQuitting = false;

    this.initApp();
    this.setupIpcHandlers();
  }

  initApp() {
    app.on("ready", () => {
      this.createTray();
      this.createControlWindow();
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
  }

  createTray() {
    const iconPath = path.join(__dirname, "icon.png");
    this.tray = new Tray(iconPath);
    const trayMenu = Menu.buildFromTemplate([
      {
        label: "Open Control",
        click: () => this.showControlWindow(),
      },
      { type: "separator" },
      {
        label: "Close",
        click: () => {
          this.isQuitting = true;
          app.quit();
        },
      },
    ]);

    this.tray.setToolTip("Overlay Manager");
    this.tray.setContextMenu(trayMenu);
  }

  createControlWindow() {
    this.controlWindow = new BrowserWindow({
      width: 800,
      height: 800,
      frame: true,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      show: false,
      autoHideMenuBar: true,
    });

    this.controlWindow.removeMenu();

    const controlPath = path.join(__dirname, "control.html");
    this.controlWindow.loadFile(controlPath);

    this.controlWindow.once("ready-to-show", () => {
      this.controlWindow.show();
    });

    this.controlWindow.on("close", (event) => {
      if (!this.isQuitting) {
        new Notification({
          title: "Right click on the tray to reopen control",
        }).show();

        event.preventDefault();
        this.controlWindow.hide();
      }
    });
  }

  showControlWindow() {
    if (!this.controlWindow || this.controlWindow.isDestroyed()) {
      this.createControlWindow();
    } else {
      this.controlWindow.show();
      this.controlWindow.focus();
    }
  }

  createOverlay({ x, y, width, height, url }) {
    const overlayWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    overlayWindow.loadURL(url || "about:blank");
    overlayWindow.setIgnoreMouseEvents(true);

    overlayWindow.on("resize", () => this.syncOverlayBounds(overlayWindow));
    overlayWindow.on("move", () => this.syncOverlayBounds(overlayWindow));

    this.overlays.push(overlayWindow);
    this.updateOverlaysInControl();
  }

  removeOverlay(index) {
    if (this.overlays[index]) {
      this.overlays[index].close();
      this.overlays.splice(index, 1);
      this.updateOverlaysInControl();
    }
  }

  syncOverlayBounds(overlayWindow) {
    const index = this.overlays.indexOf(overlayWindow);
    if (index === -1 || !this.controlWindow) return;

    const bounds = overlayWindow.getBounds();
    this.controlWindow.webContents.send("sync-overlay-bounds", {
      index,
      ...bounds,
    });
  }

  updateOverlaysInControl() {
    if (this.controlWindow) {
      const overlaysInfo = this.overlays.map((overlay, index) => ({
        index,
        ...overlay.getBounds(),
        url: overlay.webContents.getURL(),
      }));
      this.controlWindow.webContents.send("update-overlays", overlaysInfo);
    }
  }

  setupIpcHandlers() {
    ipcMain.on("create-overlay", (_, overlayConfig) => {
      this.createOverlay(overlayConfig);
    });

    ipcMain.on("update-overlay", (_, { index, x, y, width, height, url }) => {
      const overlayWindow = this.overlays[index];
      if (!overlayWindow) return;

      overlayWindow.setBounds({ x, y, width, height });
      if (url) overlayWindow.loadURL(url);
    });

    ipcMain.on("remove-overlay", (_, index) => {
      this.removeOverlay(index);
    });

    ipcMain.on("update-opacity", (_, { index, opacity }) => {
      const overlayWindow = this.overlays[index];
      if (!overlayWindow) return;

      overlayWindow.setOpacity(opacity);
    });

    ipcMain.on("toggle-interactivity", (_, { index, isInteractive }) => {
      const overlayWindow = this.overlays[index];
      if (!overlayWindow) return;

      overlayWindow.setIgnoreMouseEvents(!isInteractive, {
        forward: isInteractive,
      });
    });

    ipcMain.on("update-opacity", (_, { index, opacity }) => {
      const overlayWindow = this.overlays[index];
      if (!overlayWindow) return;

      overlayWindow.setOpacity(opacity);
    });
  }
}

new OverlayManager();
