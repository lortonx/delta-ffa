const {Eventify,debounce} = require('../libs/eventify')
const WebSocket = require('ws')

class WT extends Eventify {
    constructor(url = 'wss://tracker.openwebtorrent.com/?client_1'){
        super()
        this.url = url
        this.ws = null
        this.reconnectTimer = null
        this.debounce_send = debounce(this.send.bind(this),200)
    }
    send(data){
        if(this.isOpened()) this.ws.send(JSON.stringify(data))
        else console.error('Can\'t send: ws not opened')
    }
    isOpened(){
        return this.ws && this.ws.readyState === 1
    }
    get isConnecting(){
        return this.ws && this.ws.readyState == this.ws.CONNECTING
    }
    connect(){
            this.ws = new WebSocket(this.url)
            this.ws.onopen = e => this.onOpen()
            this.ws.onerror = e => {this.emit('error');this.onClose()}
            this.ws.onclose = e => this.onClose()
            this.ws.onmessage = e =>{
                var data = JSON.parse(e.data)
                this.emit('message', data)
            }
    }
    reset(){
        if(this.ws){
            this.onopen = this.onerror = this.onclose = this.onmessage = null
            this.ws.close()
            this.ws = null
        }
    }
    onClose(){
        this.reset()
        this.emit('close')
    }
    onOpen(){
        this.emit('open')
    }
}
  
module.exports = {WT}