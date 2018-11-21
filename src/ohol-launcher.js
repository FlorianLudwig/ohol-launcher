import { app, ipcMain } from 'electron'
import * as childProcess from 'child_process'
import * as fs from 'fs'

import './ohol'

const request = require('request')
const Store = require('electron-store')

const SERVER_LIST = 'http://onehouronelife.com/reflector/server.php?action=report'

const store = new Store()
let mainWindow = null;

function showSetupWizard() {
  mainWindow.loadURL(`file://${__dirname}/setup.html`)
}

function findExecutable(path) {
  for (let exe of ['/OneLifeApp', '/OneLife.exe']) {
    if (fs.existsSync(path + exe)) {
      console.log('Executable found', path + exe)
      return path + exe
    }
  }
  return null
}

function updateServerData() {
  request(SERVER_LIST, { json: true }, (err, res, body) => {
    let serverList = body.split('<br><br>');
    serverList = serverList.splice(1, serverList.length - 4);
    serverList = serverList.map((server) => {
      const details = server.split(' ');
      const ip = details[1];
      const serverPort = details[3];
      const currentPlayers = Number(details[5]);
      const maxPlayers = Number(details[7]);

      return {
        name: ip,
        address: ip,
        port: serverPort,
        online: true,
        current_players: currentPlayers,
        max_players: maxPlayers
      }
    })

    serverList = {
      official: serverList,
      community: []
    }

    setTimeout(updateServerData, 5000)
    if (err) {
      return console.log(err)
    }
    mainWindow.webContents.send('server-list', serverList)
  });
}

function showServerScreen() {
  mainWindow.loadURL(`file://${__dirname}/index.html`)
  mainWindow.webContents.on('did-finish-load', () => {
    updateServerData()
  })
}

function changeGamePath(path) {
  mainWindow.loadURL(`file://${__dirname}/setup_checking.html`)

  if (findExecutable(path) == null) {
    // not a valid dir, go back to setup screen
    // TODO show error message
    showSetupWizard()
    return
  }

  store.set('install_path', path)
  showServerScreen()
}

function updateConfig(config) {
  let path = store.get('install_path')
  for (let key in config) {
    let value = config[key]
    console.log('setting', key, 'to', value)
    let cfgPath = `${path}/settings/${key}.ini`
    fs.writeFileSync(cfgPath, value.toString());
  }
}

let oholProcess = null
function startGame() {
  console.log('starting ohol')
  let path = store.get('install_path')
  console.log(path)
  // TODO handle already running process
  let opt = {
    cwd: path,
    detached: true,
    stdio: 'inherit'
  }
  let exe = findExecutable(path)
  oholProcess = childProcess.spawn(exe, [], opt)
}

function SetupIpc() {
  ipcMain.on('show-screen', (event, arg) => {
    if (arg === 'server') {
      showServerScreen()
    } else {
      console.log('unkown screen', arg)
    }
  })

  ipcMain.on('set-game-path', (event, arg) => {
    changeGamePath(arg)
  })

  ipcMain.on('update-game-config', (event, arg) => {
    updateConfig(arg)
  })

  ipcMain.on('start-game', (event, arg) => {
    if (arg.config) {
      updateConfig(arg.config)
    }
    startGame()
  })
}

export function main(window) {
  console.log('config location', app.getPath('userData'))
  SetupIpc()

  mainWindow = window
  if (store.get('install_path') === undefined) {
    showSetupWizard()
  } else {
    showServerScreen()
  }
}
