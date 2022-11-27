

// @ts-check
class Router {
    /**
     * @param {import('./Listener').default} listener
     */
    constructor(listener) {
        this.listener = listener;
        this.disconnected = false;
        this.disconnectionTick = NaN;
        /** @type {import('../worlds/World').default} default player */
        this.world = null
        this.hasWorld = false

        this.mouseX = 0;
        this.mouseY = 0;

        // /** @type {string=} */
        // this.spawningName = null;
        this.requestingSpectate = false;
        this.isPressingQ = false;
        this.hasProcessedQ = false;

        this.hasPlayer = 0;
        /** @type {Player} default player */
        this.player = null;
        /** @type {Map<number, Player>} собственные игроки*/ 
        this.players = new Map()
        /** @type {{[cellId: string]: Cell}} */
        this.visibleCells = { };
        /** @type {{[cellId: string]: Cell}} */
        this.lastVisibleCells = { };
        /** @type {ViewArea} */
        // this.viewArea = {
        //     x: 0,
        //     y: 0,
        //     w: 1024 / 2 * this.settings.playerViewScaleMult,
        //     h: 600 / 2 * this.settings.playerViewScaleMult,
        //     s: 1
        // };
        /** @type {PlayerState} */
        this.state = -1;

        this.listener.addRouter(this);
    }

    /** @abstract @returns {string} */
    static get type() { throw new Error("Must be overriden"); }
    /** @returns {string} */ // @ts-ignore
    get type() { return this.constructor.type; }

    /** @abstract @returns {boolean} */
    static get isExternal() { throw new Error("Must be overriden"); }
    /** @returns {boolean} */ // @ts-ignore
    get isExternal() { return this.constructor.isExternal; }

    /** @abstract @returns {boolean} */
    static get separateInTeams() { throw new Error("Must be overriden"); }
    /** @returns {boolean} */ // @ts-ignore
    get separateInTeams() { return this.constructor.separateInTeams; }

    get handle() { return this.listener.handle; }
    get logger() { return this.listener.handle.logger; }
    get settings() { return this.listener.handle.settings; }

    get anyPlay() {
        for(const [id, player] of this.players){
            if(player.state == 0) return true
        }
        return false
    }

    createPlayer() {
        // нужно проверять да бы не вызывалось несколько раз
        // if (this.hasPlayer) return;
        this.hasPlayer ++;
        const player = this.listener.handle.createPlayer(this);
        if(!this.player) this.player = player
        this.players.set(player.id, player)
    }
    destroyPlayer() { // нигде не вызывается
        // if (!this.hasPlayer) return;
        for (const [id, player] of this.players) {
            this.hasPlayer --;
            this.listener.handle.removePlayer(player.id);
            if(player.id == this.player.id) this.player = null;
        }
    }

    /** @virtual */
    onWorldSet() { }
    /** @virtual */
    onWorldReset() { }
    /** @param {PlayerCell} cell @virtual */
    onNewOwnedCell(cell) { }

    // /** @virtual */
    // onSpawnRequest() {
    //     // if (!this.hasPlayer) return;
    //     let name = this.spawningName.slice(0, this.settings.playerMaxNameLength);
    //     /** @type {string} */
    //     let skin;
    //     if (this.settings.playerAllowSkinInName) {
    //         const regex = /\<(.*)\>(.*)/.exec(name);
    //         if (regex !== null) {
    //             name = regex[2];
    //             skin = regex[1];
    //         }
    //     }
    //     for(const [id, player] of this.players){
    //         if(player.state != 0) this.listener.handle.gamemode.onPlayerSpawnRequest(player, name, skin);
    //     }
    // }
    /**
     * @param {number} pid
     * @param {string} name
     */
    onSpawnRequest(pid, name){
        const player = this.players.get(pid)
        if(player){
            player.spawningName = name
            player.spawnRequested = true
        }
    }
    /** @virtual */
    onSpectateRequest() {
        if (!this.hasPlayer) return;
        this.player.updateState(1);
    }
    /** @virtual */
    onQPress() {
        if (!this.hasPlayer) return;
        this.listener.handle.gamemode.whenPlayerPressQ(this.player);
    }
    /** 
     * @virtual
     * @param {number} pid 
     * @param {boolean} is_pressed
     * */
    onMacroPress(pid, is_pressed) {
        const player = this.players.get(pid)
        if(player) {
            if(is_pressed == false) player.ejectMacroProcessed = false
            player.ejectMacroPressed = is_pressed
        }
        
    }
    /** @param {Player} player @virtual */
    attemptEject(player) {
        this.listener.handle.gamemode.whenPlayerEject(player);
    }
    ejectAttemptAdd(pid){
        const player = this.players.get(pid)
        if(player) player.ejectAttempts ++
    }
    /** @param {Player} player @virtual */
    attemptSplit(player) {
        this.listener.handle.gamemode.whenPlayerSplit(player);
    }
    splitAttemptAdd(pid){
        const player = this.players.get(pid)
        if(player){
            player.splitAttempts ++
        }
    }

    /** @virtual */
    close() {
        this.listener.removeRouter(this);
    }

    /** @abstract @returns {boolean} */
    get shouldClose() {
        throw new Error("Must be overriden");
    }
    /** @abstract */
    update() {
        throw new Error("Must be overriden");
    }
    updateVisibleCells() {
        // if (this.world === null) return;
        delete this.lastVisibleCells;
        this.lastVisibleCells = this.visibleCells;
        let visibleCells = this.visibleCells = { };
        for(const [id,player] of this.players){
            for (let i = 0, l = player.ownedCells.length; i < l; i++) {
                const cell = player.ownedCells[i];
                visibleCells[cell.id] = cell;
            }
            player.world.finder.search(player.viewArea, (cell) => visibleCells[cell.id] = cell);
        }

        // check last visible in bounds
        // calculate 
    }
}

export default Router;

import Cell from "../cells/Cell";
import PlayerCell from "../cells/PlayerCell";
import Player from "../worlds/Player";

