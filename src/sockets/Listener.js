// @ts-check
'use strict';
// const uWS = require('./uWebSockets.js-18.14.0/uws.js')
//const WebSocket = require("ws"); 
//const WebSocketServer = WebSocket.Server;

const uWS = require('uWebSockets.js') 
const net = require('net');
const {WT} = require('./WT.js');
// const wrtc = require('wrtc')
const {Peer} = require('./microPeer.js')
// console.log(wrtc)

const Connection = require("./Connection");
const ChatChannel = require("./ChatChannel");
const { filterIPAddress } = require("../primitives/Misc");

class ConnectionData{
	/**
	 * @param {uWS.HttpResponse} res 
	 * @param {uWS.HttpRequest} req 
	 */
	constructor(res, req){
		this.connectedTime = new Date().getTime()
		/**@type {*}   */this.user = null
		/**@type {String} */this.ip = req.getHeader('fly-client-ip')|| req.getHeader('x-forwarded-for').split(",")[0] || new Uint8Array(res.getRemoteAddress().slice(-4)).join('.')
		/**@type {String} */this.url = req.getUrl()+'?'+req.getQuery()
        // @ts-ignore
		/**@type {Object} */this.query = ((string)=>{let qu={};string.replace(/([^?=&]+)(=([^&]*))?/g, function(e,t,o,r){qu[t]=r}); return qu})(req.getQuery())
		/**@type {String} */this.origin = req.getHeader('origin')
		/**@type {String} */this.websocketKey = req.getHeader('sec-websocket-key')
		/**@type {Object} */this.connector = null
		this.remoteProxiedAddres = new TextDecoder().decode(res.getProxiedRemoteAddressAsText())
		this.remoteAddress = new TextDecoder().decode(res.getRemoteAddressAsText())
		this.headers = {
			'accept-encoding': null,		//'gzip, deflate, br',
			'accept-language': null,		//'tr,en;q=0.9,en-GB;q=0.8,en-US;q=0.7',
			'cache-control': null,		//'no-cache',
			'connection': null,		//'Upgrade',
			'host': null,		//'snez.org:8080',
			'origin': null,		//'https://deltav4.gitlab.io',
			'pragma': null,		//'no-cache',
			'sec-websocket-extensions': null,		//'permessage-deflate; client_max_window_bits',
			'sec-websocket-key': null,		//'Gtrj47DmRKJlDU3GTNVuyQ==',
			'sec-websocket-protocol': null,		//'bearer',
			'sec-websocket-version': null,		//'13',
			'upgrade': null,		//'websocket',
			'user-agent': null,		//'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36 Edg/97.0.1072.55'
		}
		this.hlist = []
		// this.headers2 = {}
		this.isDelta = false
		this.readHeaders(req)
		return this
	}
	/**
	 * @param {uWS.HttpRequest} req 
	 */
	readHeaders(req){
		req.forEach((key, value)=>{
			this.hlist.push(key)
			this.headers[key] = value
		})

	}
	get isNode(){
		const test = 'sec-websocket-'
		if( this.hlist[0].indexOf(test)>-1 || this.hlist[1].indexOf(test)>-1) {
			console.log('nodejs detected', this.ip)
			return true
		}
		return false
	}
}

class Listener {
    /**
     * @param {ServerHandle} handle
     */
    constructor(handle) {
        /** @type {uWS.TemplatedApp} */
        this.listenerSocket = null;
        /** @type {ServerHandle} */
        this.handle = handle;
        this.globalChat = new ChatChannel(this);

        /** @type {Router[]} */
        this.routers = [];
        /** @type {Connection[]} */
        this.connections = [];
        /** @type {Counter<IPAddress>} */
        this.connectionsByIP = {};
        /* Антиддос система */
        this.sock = null
        /** @type {[uWS.HttpResponse, {socketData: ConnectionData, connection?: Connection}, string, string, string, uWS.us_socket_context_t][]} */
        this.upgradeQueue = []
        this.CONN_THROTTLE = 5;
        this.conn = 0
        this.upgradeInterval = setInterval(() => {
            this.conn = 0;
            if (!this.upgradeQueue.length) return;
            for (let i = Math.min(this.CONN_THROTTLE || 1, this.upgradeQueue.length); i > 0; i--) {
                const [res, u_data, key, protocol, ext, context] = this.upgradeQueue.shift();
                u_data.connection = new Connection(this, u_data.socketData);
                res.upgrade(u_data.socketData, key, protocol, ext, context);
            }
        }, 250);
    }

    get settings() { return this.handle.settings; }
    get logger() { return this.handle.logger; }

    open() {
        if (this.listenerSocket !== null) return false;
        this.logger.debug(`listener opening at ${this.settings.listeningPort}`);
        /*this.listenerSocket = new WebSocketServer({
            port: this.settings.listeningPort,
            verifyClient: this.verifyClient.bind(this)
        }, this.onOpen.bind(this));*/
        this.listenerSocket = uWS./*SSL*/App({
        }).ws('/', {
            /* There are many common helper features */
            idleTimeout: 36000,
            maxBackpressure: 51200,
            maxPayloadLength: 51200,
            compression: uWS.SHARED_COMPRESSOR,
            upgrade: this.verifyClient.bind(this),
            open: this.onConnection.bind(this),
            message: (ws, message, isBinary) => {
                ws.connection.onSocketMessage(message, isBinary)
            },
            /** @param {uWS.WebSocket & {connection:import('./Connection')}} ws */ // @ts-ignore
            close: (ws, code, message) => {
                console.log(code, message, this.connectionsByIP)
                const decoder = new TextDecoder("utf-8");
                const string = decoder.decode(message)
                ws.connection.onSocketClose(code, string)
            }
            
        }).get('/ping',(res, req) => {
            res.end('pong!');
        }).listen(8089, (listenSocket) => {
            this.sock = listenSocket
            if (listenSocket) this.logger.debug(`listener opening at ${this.settings.listeningPort}`);
            console.log(listenSocket,`listener opening at ${this.settings.listeningPort}`)
        })


        var addrRegex = /^(([a-zA-Z\-\.0-9]+):)?(\d+)$/;
        var addr = {
            from: addrRegex.exec(''+this.settings.listeningPort),
            to: addrRegex.exec('8089')
        };
        var netService = net.createServer(function(socket) {
            console.log('socket connected');
           
            socket.on('data', data => {
                // console.log('client=>server',/* data*/);
            })
            socket.on('close', () => {
                socket.destroy()
                console.log('client=>server CLOSE');
            })
            socket.on('error', err => {
                socket.destroy()
                console.log('client=>server ERROR'/*, err*/);
            })
            // @ts-ignore
            var to = net.createConnection({
                host: addr.to[2],
                port: addr.to[3]
            });
            socket.pipe(to);
            to.pipe(socket);

            var address = netService.address();
            // console.log("Stream on", address, socket.address());
            // console.log("opened server on", socket);
            console.log('Started')

            to.on('data', data => {
                // console.log('server=>client'/*, data*/);
            })
            to.on('close', () => {
                console.log('server=>client CLOSE');
                to.destroy()
            })
            to.on('error', err => {
                to.destroy()
                console.log('server=>client ERROR'/*, err*/);
            })
            // @ts-ignore
        }).listen(addr.from[3], addr.from[2]);



        /// WEBRTC

        // const myPeer = new Peer({
        //     id: Math.random(), 
        //     info_hash: this.settings.serverName
        // }, new WT('wss://tracker.openwebtorrent.com/?client_1'))

        // myPeer.on('connect', (Web) => {
        //     console.log('created')
        //     const newConnection = new Connection(this, {ip:'127.0.0.1'});
        //     Web.connection = newConnection

        //     if(Web._channel._send){
        //         const old_send = Web._channel.send.bind(Web._channel)
        //         Web._channel.send = function(data){
        //             if(this.readyState === "open") old_send(data)
        //         }
        //     }
        //     Web.webSocket = {
        //         connnection : Web,
        //         send: (e)=>{
        //             if(Web._channel.readyState === "open")  Web.send(e)
        //         },
        //         end: Web.destroy
        //     }
        //     this.onConnection(Web)

        //     Web.on('data',(e)=>{
        //         // console.log(e+'')
        //         newConnection.onSocketMessage(e)
        //     })

        //     Web.on('close',()=>{
        //         console.log('peer closed')
        //         newConnection.onSocketClose('1006','Closed by RTCDataChannel')
        //     })

        
        
        // })
        
        
        // myPeer.on('created',/** @param {WebRtcConnector} Web*/(Web) => {
        //     // console.log('created',Web)
        //     let listener
        //     Web.on('datachannel',listener = /** @param {RTCDataChannel} ch*/ (ch)=>{
        //         ch.binaryType = "arraybuffer";
        //         const old_send = ch.send.bind(ch)
        //         const newConnection = new Connection(this, {ip:'127.0.0.1'});
        //         let isOpened = false
        //         ch.onopen = ()=>{
        //             // console.log('RTC ONOPEN ReADY STATE',ch.readyState)
        //             if (ch.readyState == "open") {
        //                 isOpened = true
        //                 ch.connection = newConnection
        //                 this.onConnection(ch)
        //             }
        //         }
        //         ch.end = (code, reason)=>{
        //             // console.log('RTC closed', code, reason)
        //             newConnection.onSocketClose('1006','Closed by RTCDataChannel')
        //             ch.close()
        //         }
        //         ch.send = (data, isBinary)=>{
        //             if(/*isOpened && */ch.readyState !== "open") return ch.end()
        //             ch.readyState == "open" && old_send(data)
        //         }
        //         ch.onmessage = (e)=>{
        //             // на входе arraybuffer
        //             newConnection.onSocketMessage(e.data)
        //         }
        //         // var i = 0
        //         ch.onclose = ()=>{
        //             isOpened = false
        //             ch.end = ch.onopen = ch.onmessage = ch.onclose = ()=>{}
        //             Web.removeListener('datachannel', listener)
        //             newConnection.onSocketClose('1006','Closed by RTCDataChannel')
        //         }
        //         // setInterval(()=>{ch.readyState == 'open' && ch.send('Msg from: NODE '+(i++))},1000)
        //     })
        
        //     // Web.on('connected',/** @param {WebRtcConnector} Web*/(Web) => {
        //     //     console.log('Connected p2p')
            
        //     //     // Web.on('data', (data) => {
        //     //     //     console.log('data', Web, data)
        //     //     // })
        //     //     Web.once('disconnected',()=>{
        //     //         console.log('Disonnected p2p')
        //     //     })
        //     // })
        
        // })
        
        
        
        // myPeer.announce({
        //     event:'started',
        //     numwant:0,
        //     // uploaded: 0,
        //     // downloaded: 0,
        //     // left: 0,
        // })
        // myPeer.on('announceinterval', () => {
        //     myPeer.announce({
        //         event:'stopped',
        //         numwant: 0
        //     })
        //     setTimeout(()=>{
        //         myPeer.announce({
        //             event:'started',
        //             numwant: 0
        //         })
        //     },300)

        //     // myPeer.announce({
        //     //     event:'started',
        //     //     numwant:0,
        //     //     // uploaded: 0,
        //     //     // downloaded: 0,
        //     //     // left: 0,
        //     // })
        // })
        

        //this.listenerSocket.on("connection", this.onConnection.bind(this));
        return true;
    }
    close() {
        if (this.listenerSocket === null) return false;
        clearInterval(this.upgradeInterval);
        this.logger.debug("listener closing");
        //this.listenerSocket.close();
        this.sock && uWS.us_listen_socket_close(this.sock);
        this.sock = null
        this.listenerSocket = null;
        return true;
    }

    /**
     * @param {uWS.HttpResponse} res 
     * @param {uWS.HttpRequest} req 
     * @param {uWS.us_socket_context_t} context 
     */
    verifyClient(res, req, context) {
        let socketData = new ConnectionData(res, req)

        const address = filterIPAddress(socketData.ip);
        this.logger.onAccess(`REQUEST FROM ${address}, Origin: ${socketData.origin}`);
        if (this.connections.length > this.settings.listenerMaxConnections) {
            this.logger.debug("listenerMaxConnections reached, dropping new connections");
            return res.end('Service Unavailable', true)
            // return void response(false, 503, "Service Unavailable");
        }
        const acceptedOrigins = this.settings.listenerAcceptedOrigins;
        if (acceptedOrigins.length > 0 && acceptedOrigins.indexOf(socketData.origin) === -1) {
            this.logger.debug(`listenerAcceptedOrigins doesn't contain ${socketData.origin}`);
            return res.end('Forbidden', true)
            // return void response(false, 403, "Forbidden");
        }
        if (this.settings.listenerForbiddenIPs.indexOf(address) !== -1) {
            this.logger.debug(`listenerForbiddenIPs contains ${address}, dropping connection`);
            return res.end('Forbidden', true)
            // return void response(false, 403, "Forbidden");
        }
        if (this.settings.listenerMaxConnectionsPerIP > 0) {
            const count = this.connectionsByIP[address];
            if (count && count >= this.settings.listenerMaxConnectionsPerIP) {
                this.logger.debug(`listenerMaxConnectionsPerIP reached for '${address}', dropping its new connections`);
                return res.end('Forbidden', true)
                // return void response(false, 403, "Forbidden");
            }
        }
        this.logger.debug("client verification passed");

        if (this.conn < this.CONN_THROTTLE) {
            const connection = new Connection(this, socketData);
            res.upgrade({socketData, connection},
                req.getHeader('sec-websocket-key'),
                req.getHeader('sec-websocket-protocol'),
                req.getHeader('sec-websocket-extensions'),
            context);
            this.conn++;
        } else {
            this.upgradeQueue.push([
                res,
                {socketData},
                req.getHeader('sec-websocket-key'),
                req.getHeader('sec-websocket-protocol'),
                req.getHeader('sec-websocket-extensions'),
                context
            ]);
            res.onAborted(() => {
                const index = this.upgradeQueue.findIndex(item => item[0] === res);
                this.upgradeQueue.splice(index, 1);
            });
        }

        /*const newConnection = new Connection(this, socketData);
        socketData.connection = newConnection
        res.upgrade(socketData,
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
        context);*/
    }
    onOpen() {
        this.logger.inform(`listener open at ${this.settings.listeningPort}`);
    }

    /**
     * @param {Router} router
     */
    addRouter(router) {
        this.routers.push(router);
    }
    /**
     * @param {Router} router
     */
    removeRouter(router) {
        this.routers.splice(this.routers.indexOf(router), 1);
    }

    /**
     * @param {uWS.WebSocket & {connection: Connection, socketData: ConnectionData}} ws
     */
    onConnection(ws) {
        const connection = ws.connection
        ws.connection.webSocket = ws
        this.logger.onAccess(`CONNECTION FROM ${connection.remoteAddress}`);
        this.connectionsByIP[connection.remoteAddress] =
            this.connectionsByIP[connection.remoteAddress] + 1 || 1;
        this.connections.push(connection);
    }

    /**
     * @param {Connection} connection
     * @param {number} code
     * @param {string} reason
     */
    onDisconnection(connection, code, reason) {
        this.logger.onAccess(`DISCONNECTION FROM ${connection.remoteAddress} (${code} '${reason}')`);
        if (--this.connectionsByIP[connection.remoteAddress] <= 0)
            delete this.connectionsByIP[connection.remoteAddress];
        this.globalChat.remove(connection);
        this.connections.splice(this.connections.indexOf(connection), 1);
    }

    update() {
        let i, l;
        for (i = 0, l = this.routers.length; i < l; i++) {
            const router = this.routers[i];
            if (!router.shouldClose) continue;
            router.close(); i--; l--;
        }
        for (i = 0; i < l; i++) this.routers[i].update();
        for (i = 0, l = this.connections.length; i < l; i++) {
            const connection = this.connections[i];
            if (this.settings.listenerForbiddenIPs.indexOf(connection.remoteAddress) !== -1)
                connection.closeSocket(1003, "Remote address is forbidden");
            else if (Date.now() - connection.lastActivityTime >= this.settings.listenerMaxClientDormancy)
                connection.closeSocket(1003, "Maximum dormancy time exceeded");
        }
    }
}

module.exports = Listener;

const Router = require("./Router");
const ServerHandle = require("../ServerHandle");
