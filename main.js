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
    this.overlayData = [];
    this.overlayWindows = [];
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
      this.loadOverlays();
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

      this.sendOverlaysToControl();
    });

    this.controlWindow.on("close", (event) => {
      if (!this.isQuitting) {
        new Notification({
          title: "Right click on the tray to reopen control or close the app",
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

  sendOverlaysToControl() {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send("update-overlays", this.overlayData);
    }
  }

  createOverlay({ x, y, width, height, url, opacity = 1 }) {
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
    overlayWindow.setOpacity(opacity);

    const overlayIndex = this.overlayData.length;
    this.overlayData.push({ x, y, width, height, url, opacity });
    this.overlayWindows.push(overlayWindow);

    overlayWindow.on("resize", () => this.syncOverlayBounds(overlayIndex));
    overlayWindow.on("move", () => this.syncOverlayBounds(overlayIndex));

    this.sendOverlaysToControl();
    this.saveOverlays();
  }

  removeOverlay(index) {
    if (this.overlayWindows[index]) {
      this.overlayWindows[index].close();
      this.overlayWindows.splice(index, 1);
      this.overlayData.splice(index, 1);
      this.sendOverlaysToControl();
      this.saveOverlays();
    }
  }

  saveOverlays() {
    this.store.set("overlays", this.overlayData);
  }

  loadOverlays() {
    const savedOverlays = this.store.get("overlays", []);
    savedOverlays.forEach((data) => this.createOverlay(data));
  }

  syncOverlayBounds(index) {
    if (!this.controlWindow || !this.overlayWindows[index]) return;

    const bounds = this.overlayWindows[index].getBounds();
    this.overlayData[index] = { ...this.overlayData[index], ...bounds };

    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send("sync-overlay-bounds", {
        index,
        ...bounds,
      });
    }

    this.saveOverlays();
  }

  setupIpcHandlers() {
    ipcMain.on("create-overlay", (_, overlayConfig) => {
      this.createOverlay(overlayConfig);
    });

    ipcMain.on("update-overlay", (_, { index, x, y, width, height, url }) => {
      const overlayWindow = this.overlayWindows[index];
      if (!overlayWindow) return;

      if (
        x !== undefined &&
        y !== undefined &&
        width !== undefined &&
        height !== undefined
      ) {
        overlayWindow.setBounds({ x, y, width, height });
        this.overlayData[index] = {
          ...this.overlayData[index],
          x,
          y,
          width,
          height,
        };
      }

      if (url) {
        overlayWindow.loadURL(url);
        this.overlayData[index].url = url;
      }

      this.saveOverlays();
    });

    ipcMain.on("remove-overlay", (_, index) => {
      this.removeOverlay(index);
    });

    ipcMain.on("update-opacity", (_, { index, opacity }) => {
      const overlayWindow = this.overlayWindows[index];
      if (!overlayWindow) return;

      overlayWindow.setOpacity(opacity);
      this.overlayData[index].opacity = opacity;
      this.saveOverlays();
    });

    ipcMain.on("toggle-interactivity", (_, { index, isInteractive }) => {
      const overlayWindow = this.overlayWindows[index];
      if (!overlayWindow) return;

      overlayWindow.setIgnoreMouseEvents(!isInteractive, {
        forward: isInteractive,
      });
    });
  }
}

new OverlayManager();
