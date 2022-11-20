const window = global
/* LIB : EVENTIFY */
class Eventify{
    constructor(){
        this.events = {}
        this.ev = []
    }
    /**
     * 
     * @param {evs} p1 
     * @returns 
     */
    on(p1){
        let i,event,length = arguments.length,listener=arguments[length-1]
		for(i=0;length-1>i;i++){
			event = arguments[i]
			if (typeof this.events[event] !== 'object') {
				this.events[event] = []
			}
			this.events[event].push(listener)
		}
		return listener
    }
    removeListener(event, listener){
        let idx
		if (typeof this.events[event] === 'object') {
			idx = this.events[event].indexOf(listener)
			if (idx > -1) {
				this.events[event].splice(idx, 1)
			}
		}
    }
    emit(event){
        var i, listeners, length, args = [].slice.call(arguments, 1);
		if (typeof this.events[event] === 'object') {
			listeners = this.events[event].slice()
			length = listeners.length

			for (i = 0; i < length; i++) {
			//while(length--){
				listeners[i].apply(this, args)
			//}
			}
		}
    }
    once(event, listener){
        let once_listener
		this.on(event, once_listener = () => {
			this.removeListener(event, once_listener)
			listener.apply(this, arguments)
		})
		return once_listener
    }
    listenTo(target, eventName, listener){
        this.ev.push([target,eventName,listener])
        target.on(eventName, listener)
    }
    unlisten(){
        for(let i = 0;this.ev.length > i;i++){
            const target = this.ev[i][0],
                eventName = this.ev[i][1],
                listener = this.ev[i][2]
            target.removeListener(eventName,listener)
            let idx = this.ev.indexOf(this.ev[i])
            ~idx&&this.ev.splice(idx,1)
        }
    }
}


function throttle(f, t) {
	let lastCall
	return function (args) {
	  let previousCall = lastCall;
	  lastCall = Date.now();
	  if (previousCall === undefined // function is being called for the first time
		  || (lastCall - previousCall) > t) { // throttle time has elapsed
		f(args);
	  }
	}
  }

  function debounce(f, t) {
	let lastCall
	let lastCallTimer
	return function (args) {
	  let previousCall = lastCall;
	  lastCall = Date.now();
	  if (previousCall && ((lastCall - previousCall) <= t)) {
		clearTimeout(lastCallTimer);
	  }
	  lastCallTimer = setTimeout(() => f(args), t);
	}
  }

  /* LIB : DEBUG ANY OBJECT */
var Debugger = function(gState, klass, prefix) {
	var debug = {}
	//var prefux = Array.prototype.splice.call(arguments, 2)
	function replaceSupers(str) {
        var s = '₀₁₂₃₄₅₆₇₈₉'
        return str.replace(/[0-9]/g, str.charAt.bind(s))
    }
	function inject(){
		if (gState && klass.isDebug) {
		  for (var m in console)
			if (typeof console[m] == 'function' && m!=='profile'){
				// const mt = m
				// Object.defineProperty(klass, mt, {
				// 	get: ()=>{
				// 		/*let c = console[mt]
				// 		c=c.bind(c, ''+new Date().toTimeString().replace(/^(\d{2}:\d{2}:\d{2}).+/, '$1'))
				// 		for(let i=0;prefux.length>i;i++){
				// 			const arg = prefux[i]
				// 			c = c.bind(c,arg)
				// 		}
				// 		return c*/
				// 		/*return console[mt].bind(window.console, 
				// 			new Date().toTimeString().replace(/^(\d{2}:\d{2}:\d{2}).+/, '$1'),
				// 			...prefux
				// 			)*/
				// 		//return console[mt].bind(window.console, new Date().toTimeString().replace(/^(\d{2}:\d{2}:\d{2}).+/, '$1'),prefix||klass.toString()+": ")
				// 		return console[mt].bind(window.console, replaceSupers(new Date().toTimeString().replace(/^(\d{2}:\d{2}:\d{2}).+/, '$1'))+' '+prefix||klass.toString()+": ")
				// 	},
				// 	set:(x)=>{}
				// });
				debug[m] = console[m].bind(window.console, prefix||klass.toString()+": ")
				//debug[m] = console[m].apply.bind.apply(console[m],prefux)
				//console.log('new args',arguments,prefux)
			}
			  
		}else{
		  for (var m in console)
			if (typeof console[m] == 'function' && m!=='profile')
			  debug[m] = function(){}
		}
	  Object.assign(klass,debug)
	}
	klass._isDebug = klass.isDebug
	Object.defineProperty(klass, 'isDebug', {
		set: function(x) {
			this._isDebug = x
			inject()
		},get:function(){return this._isDebug}
	})
	inject()
		
}


module.exports = {Eventify,throttle,debounce,Debugger}