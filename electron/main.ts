import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { CLIBridge } from './cli-bridge'
import { Database } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { CCSwitchIntegration } from './ccswitch'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const cliBridge = new CLIBridge()
const database = new Database()
const ccswitch = new CCSwitchIntegration()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f19',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../resources/icon.png'),
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 MiniCode', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => { tray?.destroy(); app.quit() } },
  ])

  tray.setToolTip('MiniCode')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => mainWindow?.show())
}

app.whenReady().then(() => {
  database.init()
  ccswitch.init()
  createWindow()
  createTray()
  registerIpcHandlers(mainWindow!, cliBridge, database, ccswitch)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  cliBridge.killAll()
  database.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  cliBridge.killAll()
  database.close()
})

export { mainWindow }
