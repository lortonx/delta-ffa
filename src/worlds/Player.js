// @ts-check
import Cell from "../cells/Cell"
import PlayerCell from "../cells/PlayerCell"
import ServerHandle from "../ServerHandle"
import Connection from "../sockets/Connection"
import World from "./World"
/**
 * Всё что связано с единичным игроком
 */
class Player {
    /**
     * @param {ServerHandle} handle
     * @param {number} id
     * @param {Connection} router
     */
    constructor(handle, id, router) {
        this.handle = handle;
        this.id = id;
        this.connection = router;
        this.exists = true;
        this.ejectAttempts = 0
        this.splitAttempts = 0
        this.ejectMacroPressed = false
        this.ejectMacroProcessed = false
        this.spawnRequested = false
        this.ejectTick = this.handle.tick;
        
        this.mouseX = 0
        this.mouseY = 0

        /** @type {number} */
        this.extraDecayMult = 0
        /** @type {string} */
        this.leaderboardName = null;
        /** @type {string} */
        this.spawningName = null;
        /** @type {string} */
        this.cellName = null;
        this.chatName = "Spectator";
        /** @type {string} */
        this.cellSkin = null;
        /** @type {number} */
        this.cellColor = 0x7F7F7F;
        /** @type {number} */
        this.chatColor = 0x7F7F7F;

        /** @type {PlayerState} */
        this.state = -1;
        this.life = 0;
        this.hasWorld = false;
        /** @type {World} */
        this.world = null;
        /** @type {any} */
        this.team = null;
        this.score = NaN;

        /** @type {PlayerCell[]} */
        this.ownedCells = [];
        // /** @type {{[cellId: string]: Cell}} */
        // this.visibleCells = { };
        // /** @type {{[cellId: string]: Cell}} */
        // this.lastVisibleCells = { };
        /** @type {ViewArea} */
        this.viewArea = {
            x: 0,
            y: 0,
            w: 1024 / 2 * handle.settings.playerViewScaleMult,
            h: 600 / 2 * handle.settings.playerViewScaleMult,
            s: 1
        };
    }

    get settings() { return this.handle.settings; }

    destroy() {
        if (this.hasWorld) this.world.removePlayer(this);
        this.exists = false;
    }

    /**
     * @param {PlayerState} targetState
     */
    updateState(targetState) {
        if (this.world === null)                            this.state = -1; // idle
        else if (this.ownedCells.length > 0)                this.state = 0;  // playing
        else if (targetState === -1)                        this.state = -1; // idle
        else if (this.world.largestPlayer === null)         this.state = 2;  // roaming
        else if (this.state === 1 && targetState === 2)     this.state = 2;  // roaming
        else                                                this.state = 1;  // spectating
    }

    updateViewArea() {
        if (this.world === null) return;
        let s;
        switch (this.state) {
            case -1: this.score = NaN; break;
            case 0: // playing
                let x = 0, y = 0, score = 0; s = 0;
                const l = this.ownedCells.length;
                for (let i = 0; i < l; i++) {
                    const cell = this.ownedCells[i];
                    x += cell.x;
                    y += cell.y;
                    s += cell.size;
                    score += cell.mass;
                }
                this.viewArea.x = x / l;
                this.viewArea.y = y / l;
                this.score = score;
                s = this.viewArea.s = Math.pow(Math.min(64 / s, 1), 0.4);
                this.viewArea.w = 1024 / s / 2 * this.settings.playerViewScaleMult;
                this.viewArea.h = 600 / s / 2 * this.settings.playerViewScaleMult;
                break;
            case 1: // spectating
                this.score = NaN;
                const spectating = this.world.largestPlayer;
                this.viewArea.x = spectating.viewArea.x;
                this.viewArea.y = spectating.viewArea.y;
                this.viewArea.s = spectating.viewArea.s;
                this.viewArea.w = spectating.viewArea.w;
                this.viewArea.h = spectating.viewArea.h;
                break;
            case 2: // roaming
                this.score = NaN;
                let dx = this.connection.mouseX - this.viewArea.x;
                let dy = this.connection.mouseY - this.viewArea.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                const D = Math.min(d, this.settings.playerRoamSpeed);
                if (D < 1) break; dx /= d; dy /= d;
                const border = this.world.border;
                this.viewArea.x = Math.max(border.x - border.w, Math.min(this.viewArea.x + dx * D, border.x + border.w));
                this.viewArea.y = Math.max(border.y - border.h, Math.min(this.viewArea.y + dy * D, border.y + border.h));
                s = this.viewArea.s = this.settings.playerRoamViewScale;
                this.viewArea.w = 1024 / s / 2 * this.settings.playerViewScaleMult;
                this.viewArea.h = 600 / s / 2 * this.settings.playerViewScaleMult;
                break;
        }
    }

    updateVisibleCells() {
        if (this.world === null) return;
        delete this.lastVisibleCells;
        this.lastVisibleCells = this.visibleCells;
        let visibleCells = this.visibleCells = { };
        for (let i = 0, l = this.ownedCells.length; i < l; i++) {
            const cell = this.ownedCells[i];
            visibleCells[cell.id] = cell;
        }
        this.world.finder.search(this.viewArea, (cell) => visibleCells[cell.id] = cell);

        // check last visible in bounds
        // calculate 
    }

    checkExistence() {
        if (!this.connection.disconnected) return;
        if (this.state !== 0) return void this.handle.removePlayer(this.id);
        const disposeDelay = this.settings.worldPlayerDisposeDelay;
        if (disposeDelay > 0 && this.handle.tick - this.connection.disconnectionTick >= disposeDelay)
            this.handle.removePlayer(this.id);
    }

    /** @virtual */
    onSpawnRequest() {
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
        if(this.state != 0) this.handle.gamemode.onPlayerSpawnRequest(this, name, skin);
    }
}

export default Player;
