const {WT} = require('./WT.js');
const wrtc = require('wrtc');
const SimplePeer = require('simple-peer')

const { Eventify, Debugger } = require('../libs/eventify.js');

function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
var randomBytes = ()=> Array(16).fill(0).map(()=>String.fromCharCode(Math.floor(Math.random()*255))).join('')
  

class PEER extends Eventify{
    constructor({id, info_hash}, socket, callbacks = {connected:()=>{}, data:()=>{}, disconnected:()=>{}}){
        super()
        this.callbacks = callbacks
        this.id = (id+createUUID()).substring(0,20)
        this.isDebug = true
        Debugger(true, this,'[Peer '+this.id.substring(0,10)+']:')
        this.state = 'stopped'
        this.destroyed = false
        this.reconnecting = false
        this.socket = socket
        this.info_hash = info_hash
        /** @type {Map<string,WebRtcConnector>} */
        this.offers = new Map()
        /** @type {Map<string,WebRtcConnector>} */
        this.connected = new Map()
        /** @type {Map<string,WebRtcConnector>} */
        this.answers = new Map()
        // /** @type {Map<string,WebRtcConnector>} */
        // this.pool = new Map()
        this.intervalAnnounce = 5
        this.timerAnnounce = null
        this.isGeneration = false
        this.initSocket()
        this.start()
    }
    start(){ // Start interval
        if(this.destroyed == true) return this.log('already destroyed')
        this.setInterval()
    }
    destroy(){ // Destroying peer
        if(this.destroyed == true) return this.log('already destroyed')
        this.unlisten()
        this.stop()
        for(const [id, Web] of this.offers) Web.destroy()
        for(const [id, Web] of this.connected) Web.destroy()
        this.events = {}
    }
    stop(){ // Stopping announces
        clearInterval(this.timerAnnounce)
        this.socket.send(this.generateStopInfo())
    }
    setInterval(){
        clearInterval(this.timerAnnounce)
        this.timerAnnounce = setInterval(()=>{
            this.emit('announceinterval')
        }, this.intervalAnnounce * 1000)
    }
    async announce(opts = {}, callback){
        if (this.destroyed || this.reconnecting) return
        if (!this.socket.isOpened()) {
            !this.socket.isConnecting && this.socket.connect()
            this.socket.once('open', () => {
              this.announce(opts)
            })
            return
        }
        const params = Object.assign({}, opts, {
            'action': 'announce',
            'info_hash': this.info_hash,
            'peer_id': this.id
        })
        // if (this._trackerId) params.trackerid = this._trackerId
        if (opts.event === 'stopped' || opts.event === 'completed') {
            opts.event = this.state = 'stopped'
            params.numwant = 0
            params.uploaded = 0
            params.downloaded = 0
            params.left = 0
            // Don't include offers with 'stopped' or 'completed' event
            this.socket.send(params)
            callback && callback()
            return
        } else if(this.state != 'stopped' || opts.event == 'started'){
            opts.event = this.state == 'started'?'update':'started'
            if(this.isGeneration) return
            // Limit the number of offers that are generated, since it can be slow
            const numwant = Math.min(opts.numwant, 10)
            this.generateOffers(numwant, offers => {
                params.numwant = numwant
                params.offers = offers
                this.socket.send(params)
                callback && callback()
                // this.socket.debounce_send(params)
            })
        }
    }
    async generateOffers(numwant, callback){
        if(this.isGeneration) return
        this.isGeneration = true
        const result_offers = []
        let targetWant = numwant - this.offers.size
        const promises = []
        while(targetWant--){
            // const Web = new WebRtcConnector(this)
            const Web = new SimplePeer({ initiator: true ,trickle: false, iceCompleteTimeout:1000, wrtc: typeof wrtc !== 'undefined'?wrtc:undefined})
            Web.id = createUUID()
            // this.emit('created', Web)
            // Web.listenTo(Web,'datachannel',(dc)=>{this.emit('datachannel',dc)})
            // Web.start()
           
            const promised = new Promise((res,rej)=> {
                Web.once('error',rej)
                Web.once('signal',(e)=>{
                    // console.log('signaling',e)
                    res(e)
                })
            })

            promised.then((e)=>{
                this.offers.set(Web.id, Web)
                
                Web.once('connect', () => {
                    this.emit('connect',Web)
                    this.connected.set(Web.id,Web)
                    this.offers.delete(Web.id, Web)
                    // console.log('Connected my offer')
                    // Web.send('whatever' + Math.random())
                })
                Web.on('close', () => {
                    this.connected.delete(Web.id)
                    this.offers.delete(Web.id)
                    // console.log('Disconnected my offer')
                })
                Web.on('error', () => {
                    this.offers.delete(Web.id)
                    this.connected.delete(Web.id)
                })
                // Web.on('data',(e)=>{console.log(e)})
            }).catch(()=>{
                
            })
            promises.push(promised)
        }
        await Promise.all(promises)
        for(const [id,Web] of this.offers){
            result_offers.push({
                "offer": Web._pc.localDescription,
                "offer_id": Web.id
            })
        }
        callback(result_offers)
        this.isGeneration = false
    }
    initSocket(){
        this.listenTo(this.socket, 'open',  _=>{

        })
        this.listenTo(this.socket, 'message', data => {
            // if(this.info_hash !== this.info_hash) return;
            // console.log(data)
            if(data.complete || data.incomplete) this.log({
                'Файл хеш': data.info_hash, 'Находится у': data.complete, 'Не загружен у': data.incomplete
            })
            if(data.offer) this.onOffer(data)

            if(data.answer && data.peer_id){
                this.log(this.id,'принят answer, нужно законтачится',data)
                const Web = this.offers.get(data.offer_id)
                if(!Web) return this.error('Не ответ на несуществующий оффер', data.offer_id)
                Web.remotePeerId = data.peer_id
                Web.remoteOfferId = data.to_offer_id
                Web.signal(data.answer)
            }
        })
        this.listenTo(this.socket, 'close',  _=>{

        })
    }
    onOffer(data){ // 
        this.log('ШАГ 2:  accept offer / принимаем чужие офферы/предложения')
        // const Web = new WebRtcConnector(this); Web.remotePeerId = data.peer_id
        // this.emit('created', Web)
        // Web.listenTo(Web,'datachannel',(dc)=>{this.emit('datachannel',dc)})
        // Web.start()

        const Web = new SimplePeer({ initiator: false ,trickle: false, iceCompleteTimeout:1000, wrtc: typeof wrtc !== 'undefined'?wrtc:undefined})
        Web.id = createUUID()
        Web.signal(data.offer)
        
        const promised = new Promise((res,rej)=> {
            Web.once('error',rej)
            Web.once('signal',res)
        })
        promised.then(()=>{
            var json = {
                "action": "announce",
                "info_hash": this.info_hash,
                "peer_id": this.id,
                "to_peer_id": data.peer_id, 
                "to_offer_id": Web.id,// этого нет в протоколе но работает
                "answer": Web._pc.localDescription,
                "offer_id": data.offer_id
            }
            this.socket.send(json)
          

            Web.on('connect', () => {
                this.emit('connect',Web)
                this.connected.set(Web.id,Web)
                console.log('Connected my answer')
            })
            Web.on('close', () => {
                this.connected.delete(Web.id)
            })
            Web.on('error', () => {
                this.connected.delete(Web.id)
            })
            // Web.on('data',(e)=>{console.log(e)})
        })

        

    }
    generateStopInfo(){
        const json = {
            "action": "announce",
            "event": "stopped",
            "numwant": 0,
            "uploaded": 0,
            "downloaded": 0,
            "left": 0,
            "info_hash": this.info_hash,
            "peer_id": this.id
        }
        return json
    }
}


module.exports = {Peer: PEER}



// let myPeer = global.myPeer = new Peer({
//     id: Math.random(), 
//     info_hash: 'FILE_HASHHHH2'
// }, new WT('wss://tracker.openwebtorrent.com/?client_1'))


// myPeer.on('created',/** @param {WebRtcConnector} Web*/(Web) => {
//     // console.log('created',Web)
//     Web.on('datachannel',/** @param {RTCDataChannel} ch*/ (ch)=>{
//         ch.onopen = ()=>{
//             console.log('channel opened')
//         }
//         ch.readyState == 'open'&& console.log('already opened')
//         ch.onmessage = (e)=>{
//            console.log(e.data)
//         }
//         var i = 0
//         ch.onclose = ()=>{
//             ch.onopen = ch.onmessage = ch.onclose = null
//         }
//         setInterval(()=>{ch.readyState == 'open' && ch.send('Msg from: NODE '+(i++))},1000)
//     })

//     Web.on('connected',/** @param {WebRtcConnector} Web*/(Web) => {
//         console.log('Connected p2p')
    
//         // Web.on('data', (data) => {
//         //     console.log('data', Web, data)
//         // })
//         Web.once('disconnected',()=>{
//             console.log('Disonnected p2p')
//         })
//     })

// })



// myPeer.announce({
//     event:'started',
//     numwant:0,
//     // uploaded: 0,
//     // downloaded: 0,
//     // left: 0,
// })
// myPeer.on('announceinterval', () => {
//     // myPeer.announce({
//     //     event:'stopped',
//     //     numwant: 0
//     // })
//     // myPeer.announce({
//     //     event:'started',
//     //     numwant:0,
//     //     // uploaded: 0,
//     //     // downloaded: 0,
//     //     // left: 0,
//     // })
// })
