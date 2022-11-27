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

export default ConnectionData
import * as uWS from 'uWebSockets.js'