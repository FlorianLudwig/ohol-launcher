import './ohol'
import {app, ipcMain} from 'electron'
import * as child_process from 'child_process'
import * as fs from 'fs'
var request = require('request')
const Store = require('electron-store')

const SERVER_LIST = 'http://onehour.world:8080/api/v1/servers'
const store = new Store()
var mainWindow = null;


function show_setup_wizard() {
  mainWindow.loadURL(`file://${__dirname}/setup.html`)
}


function show_server_screen() {
  mainWindow.loadURL(`file://${__dirname}/index.html`)
  mainWindow.webContents.on('did-finish-load', () => {
    update_server_data()
  })
}

function update_server_data() {
  request(SERVER_LIST, { json: true }, (err, res, body) => {
    setTimeout(update_server_data, 500)
    if (err) {
      return console.log(err)
    }
    mainWindow.webContents.send('server-list', body)
  });
}

function update_config(config) {
  var path = store.get('install_path')
  for(var key in config) {
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
  oholProcess = child_process.spawn(path + '/OneLifeApp', [], opt)
}

function setup_ipc() {
  ipcMain.on('show-screen', (event, arg) => {
    if(arg == 'server') {
      show_server_screen()
    } else{
      console.log('unkown screen', arg)
    }
  })

  ipcMain.on('set-game-path', (event, arg) => {
    // TODO check if folder actually contains the game
    console.log('set game path', arg)
    store.set('install_path', arg)
    event.returnValue = true
  })

  ipcMain.on('update-game-config', (event, arg) => {
    update_config(arg)
  })

  ipcMain.on('start-game', (event, arg) => {
    if(arg.config) {
      update_config(arg.config)
    }
    start_game()
  })
}

export function main(window) {
  console.log('config location', app.getPath('userData'))
  setup_ipc()

  mainWindow = window
  if(store.get('install_path') == undefined) {
    show_setup_wizard()
  } else {
    show_server_screen()
  }
}
