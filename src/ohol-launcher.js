import './ohol'
import { app, ipcMain } from 'electron'
import * as child_process from 'child_process'
import * as fs from 'fs'

const request = require('request')
const Store = require('electron-store')

const SERVER_LIST = 'http://onehouronelife.com/reflector/server.php?action=report'

const store = new Store()
let mainWindow = null;

function show_setup_wizard() {
  mainWindow.loadURL(`file://${__dirname}/setup.html`)
}

function find_executable(path) {
  for (let exe of ['/OneLifeApp', '/OneLife.exe']) {
    if (fs.existsSync(path + exe)) {
      console.log('Executable found', path + exe)
      return path + exe
    }
  }
  return null
}

function change_game_path(path) {
  mainWindow.loadURL(`file://${__dirname}/setup_checking.html`)

  if (find_executable(path) == null) {
    // not a valid dir, go back to setup screen
    // TODO show error message
    show_setup_wizard()
    return
  }

  store.set('install_path', path)
  show_server_screen()
}

function show_server_screen() {
  mainWindow.loadURL(`file://${__dirname}/index.html`)
  mainWindow.webContents.on('did-finish-load', () => {
    update_server_data()
  })
}

function update_server_data() {
  request(SERVER_LIST, { json: true }, (err, res, body) => {

    let serverList = body.split('<br><br>');
    serverList = serverList.splice(1, serverList.length - 4);
    serverList = serverList.map(server => {

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
        max_players: maxPlayers,
      }
    })

    serverList = {
      official: serverList,
      community: [],
    }

    setTimeout(update_server_data, 5000)
    if (err) {
      return console.log(err)
    }
    mainWindow.webContents.send('server-list', serverList)
  });
}

function update_config(config) {
  var path = store.get('install_path')
  for (var key in config) {
    var value = config[key]
    console.log('setting', key, 'to', value)
      var cfg_path = `${path}/settings/${key}.ini`
      fs.writeFileSync(cfg_path, value.toString());
  }
}

var oholProcess = null
function start_game() {
  console.log('starting ohol')
  var path = store.get('install_path')
  console.log(path)
  // TODO handle already running process
  var opt = {
    'cwd': path,
    'detached': true,
    'stdio': 'inherit'
  }
  var exe = find_executable(path)
  oholProcess = child_process.spawn(exe, [], opt)
}

function setup_ipc() {
  ipcMain.on('show-screen', (event, arg) => {
    if (arg == 'server') {
      show_server_screen()
    } else {
      console.log('unkown screen', arg)
    }
  })

  ipcMain.on('set-game-path', (event, arg) => {
    change_game_path(arg)
  })

  ipcMain.on('update-game-config', (event, arg) => {
    update_config(arg)
  })

  ipcMain.on('start-game', (event, arg) => {
    if (arg.config) {
      update_config(arg.config)
    }
    start_game()
  })
}

export function main(window) {
  console.log('config location', app.getPath('userData'))
  setup_ipc()

  mainWindow = window
  if (store.get('install_path') == undefined) {
    show_setup_wizard()
  } else {
    show_server_screen()
  }
}
