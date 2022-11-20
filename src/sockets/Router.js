// @ts-check
/** @interface */
class Router {
    /**
     * @param {Listener} listener
     */
    constructor(listener) {
        this.listener = listener;
        this.disconnected = false;
        this.disconnectionTick = NaN;

        this.mouseX = 0;
        this.mouseY = 0;

        /** @type {string=} */
        this.spawningName = null;
        this.requestingSpectate = false;
        this.isPressingQ = false;
        this.hasProcessedQ = false;
        this.splitAttempts = 0;
        this.ejectAttempts = 0;
        this.ejectMacroPressed = false
        this.ejectMacroProcessed = false
        this.ejectTick = listener.handle.tick;

        this.hasPlayer = false;
        /** @type {Player} */
        this.player = null;
        /** @type {Object<number, Player>} */
        this.playersById = {}
        /** @type {Player[]} */
        this.players = []

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

    createPlayer() {
        if (this.hasPlayer) return;
        this.hasPlayer = true;
        const player = this.listener.handle.createPlayer(this);
        this.player = player;
        this.playersById[player.id] = player
        this.players.push(player)
        return player
    }
    destroyPlayer() { // нигде не вызывается
        if (!this.hasPlayer) return;
        this.hasPlayer = false;
        this.listener.handle.removePlayer(this.player.id);
        this.player = null;
    }

    /** @virtual */
    onWorldSet() { }
    /** @virtual */
    onWorldReset() { }
    /** @param {PlayerCell} cell @virtual */
    onNewOwnedCell(cell) { }

    /** @virtual */
    onSpawnRequest() {
        if (!this.hasPlayer) return;
        let name = this.spawningName.slice(0, this.settings.playerMaxNameLength);
        /** @type {string} */
        let skin;
        if (this.settings.playerAllowSkinInName) {
            const regex = /\<(.*)\>(.*)/.exec(name);
            if (regex !== null) {
                name = regex[2];
                skin = regex[1];
            }
        }
        this.listener.handle.gamemode.onPlayerSpawnRequest(this.player, name, skin);
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
    /** @virtual */
    attemptSplit() {
        if (!this.hasPlayer) return;
        this.listener.handle.gamemode.whenPlayerSplit(this.player);
    }
    /** @virtual */
    attemptEject() {
        if (!this.hasPlayer) return;
        this.listener.handle.gamemode.whenPlayerEject(this.player);
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
}

module.exports = Router;

const Listener = require("./Listener");
const Player = require("../worlds/Player");
const PlayerCell = require("../cells/PlayerCell");
