//const uWS = require('./uWebSockets.js-18.14.0/uws.js')
//const WebSocket = require("ws");
//const WebSocketServer = WebSocket.Server;

const uWS = require('uWebSockets.js')
const path = require('path')


const Connection = require("./Connection");
const ChatChannel = require("./ChatChannel");
const { filterIPAddress } = require("../primitives/Misc");

class Listener {
    /**
     * @param {ServerHandle} handle
     */
    constructor(handle) {
        /** @type {WebSocketServer} */
        this.listenerSocket = null;
        this.handle = handle;
        this.globalChat = new ChatChannel(this);

        /** @type {Router[]} */
        this.routers = [];
        /** @type {Connection[]} */
        this.connections = [];
        /** @type {Counter<IPAddress>} */
        this.connectionsByIP = { };
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
            maxBackpressure: 1024,
            maxPayloadLength: 512,
            //compression: DEDICATED_COMPRESSOR_3KB,
            upgrade: this.verifyClient.bind(this),
            open: this.onConnection.bind(this),
            message: (ws, message, isBinary) => {
                ws.connection.onSocketMessage(message, isBinary)
            },
            close: (ws, code, message) => {
                ws.connection.onSocketClose(code, message)
                console.log(this.connectionsByIP)
            }
            
        }).listen(this.settings.listeningPort, (listenSocket) => {
            if (listenSocket) this.logger.debug(`listener opening at ${this.settings.listeningPort}`);
            console.log(listenSocket,`listener opening at ${this.settings.listeningPort}`)
        })

        //this.listenerSocket.on("connection", this.onConnection.bind(this));
        return true;
    }
    close() {
        if (this.listenerSocket === null) return false;
        this.logger.debug("listener closing");
        this.listenerSocket.close();
        this.listenerSocket = null;
        return true;
    }

    /**
     * @param {{req: any, origin: string}} info
     * @param {*} response
     */
    verifyClient(res, req, context) {
        const connection_ip = new Uint8Array(res.getRemoteAddress().slice(-4)).join('.')
        let socketData = {
            connection: null,
            ip: req.getHeader('fly-client-ip') || connection_ip,
            url: req.getUrl()+'?'+req.getQuery(),
            origin: req.getHeader('origin'),
            websocketKey: req.getHeader('sec-websocket-key'),
        }

        const address = filterIPAddress(socketData.ip);
        this.logger.onAccess(`REQUEST FROM ${address}, Origin: ${socketData.origin}`);
        if (this.connections.length > this.settings.listenerMaxConnections) {
            this.logger.debug("listenerMaxConnections reached, dropping new connections");
            return res.end('', null, '\t')
            return void response(false, 503, "Service Unavailable");
        }
        const acceptedOrigins = this.settings.listenerAcceptedOrigins;
        if (acceptedOrigins.length > 0 && acceptedOrigins.indexOf(socketData.origin) === -1) {
            this.logger.debug(`listenerAcceptedOrigins doesn't contain ${socketData.origin}`);
            return res.end('', null, '\t')
            return void response(false, 403, "Forbidden");
        }
        if (this.settings.listenerForbiddenIPs.indexOf(address) !== -1) {
            this.logger.debug(`listenerForbiddenIPs contains ${address}, dropping connection`);
            return res.end('', null, '\t')
            return void response(false, 403, "Forbidden");
        }
        if (this.settings.listenerMaxConnectionsPerIP > 0) {
            const count = this.connectionsByIP[address];
            if (count && count >= this.settings.listenerMaxConnectionsPerIP) {
                this.logger.debug(`listenerMaxConnectionsPerIP reached for '${address}', dropping its new connections`);
                return res.end('', null, '\t')
                return void response(false, 403, "Forbidden");
            }
        }
        this.logger.debug("client verification passed");
        //response(true);


        const newConnection = new Connection(this, socketData);
        socketData.connection = newConnection
        res.upgrade(socketData,
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
        context);
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
     * @param {WebSocket} webSocket
     */
    onConnection(ws) {
        const newConnection = ws.connection
        ws.connection.webSocket = ws
        this.logger.onAccess(`CONNECTION FROM ${newConnection.remoteAddress}`);
        this.connectionsByIP[newConnection.remoteAddress] =
            this.connectionsByIP[newConnection.remoteAddress] + 1 || 1;
        this.connections.push(newConnection);
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
