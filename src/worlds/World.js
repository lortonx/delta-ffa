
import EjectedCell from "../cells/EjectedCell"
import Fuckercell from "../cells/Fuckercell"
import Mothercell from "../cells/Mothercell"
import Pellet from "../cells/Pellet"
import Virus from "../cells/Virus"

import { fullyIntersects } from "../primitives/Misc"
import QuadTree from "../primitives/QuadTree"
import ServerHandle from "../ServerHandle"
import ChatChannel from "../sockets/ChatChannel"
import Connection from "../sockets/Connection"
import Player from "./Player"

import Cell from "../cells/Cell"
import PlayerCell from "../cells/PlayerCell"
import Bot from "../bots/Bot"
import Minion from "../bots/Minion"
import PlayerBot from "../bots/PlayerBot"

// @ts-check
/**
 * @param {any[]} arr 
 * @param {number} i 
 * @returns 
 */
function unordered_remove(arr, i) {
    if (i <= 0 || i >= arr.length) {
        return;
    }
    if (i < arr.length - 1) {
        arr[i] = arr[arr.length-1];
    }
    arr.length -= 1;
}

class World {
    /**
     * @param {ServerHandle} handle
     * @param {number} id
     */
    constructor(handle, id) {
        this.handle = handle;
        this.id = id;
        this.hadPlayers = false // only for LMS
        this.frozen = false;

        this._nextCellId = 1;
        /** @type {Cell[]} */
        this.cells = [];
        /** @type {Cell[]} */
        this.boostingCells = [];
        this.pelletCount = 0;
        this.mothercellCount = 0;
      
        this.fuckercellCount = 0;
        this.virusCount = 0;
        /** @type {EjectedCell[]} */
        this.ejectedCells = [];
        /** @type {PlayerCell[]} */
        this.playerCells = [];
        
        /** @type {Router[]} */
        this.routers = []

        /** @type {Player[]} */
        this.leaderboard = [];
        /** @type {Player[]} */
        this.players = [];
        /** @type {Player=} */
        this.largestPlayer = null;
        this.worldChat = new ChatChannel(this);

        /** @type {Rect} */
        this.border = { x: NaN, y: NaN, w: NaN, h: NaN };
        /** @type {QuadTree<import("../primitives/QuadTree").QuadItem<Cell>>} */
        this.finder = null;

        /**
         * @type {WorldStats}
         */
        this.stats = {
            limit: NaN,
            internal: NaN,
            external: NaN,
            playing: NaN,
            spectating: NaN,
            name: null,
            gamemode: null,
            loadTime: NaN,
            uptime: NaN
        };
        /** @type {{[team: number]: Player[]}} */
        this.teams = {}

        this.setBorder({ x: this.settings.worldMapX, y: this.settings.worldMapY, w: this.settings.worldMapW, h: this.settings.worldMapH });
    }

    get settings() { return this.handle.settings; }
    get nextCellId() {
        return this._nextCellId >= 0xFFFFFFFF ? (this._nextCellId = 1) : this._nextCellId++;
    }

    afterCreation() {
        for (let i = 0; i < this.settings.worldPlayerBotsPerWorld; i++)
            new PlayerBot(this);
    }
    destroy() {
        let len = this.players.length
        while (len--) {
            this.removePlayer(this.players[len]);
        }
        len = this.cells.length
        while (len--)
            this.removeCell(this.cells[len]);
        len = this.routers.length
        while (len--)
            this.removeRouter(this.routers[len]);
    }

    /**
     * @param {Rect} range
     */
    setBorder(range) {
        this.border.x = range.x;
        this.border.y = range.y;
        this.border.w = range.w;
        this.border.h = range.h;
        if (this.finder !== null) this.finder.destroy();
        this.finder = new QuadTree(
            this.border,
            this.settings.worldFinderMaxLevel,
            this.settings.worldFinderMaxItems
        );
        for (let i = 0, l = this.cells.length; i < l; i++) {
            const cell = this.cells[i];
            if (cell.type === 0) continue;
            this.finder.insert(cell);
            if (!fullyIntersects(this.border, cell.range))
                this.removeCell(cell);
        }
    }

    /** @param {Cell} cell */
    addCell(cell) {
        cell.exists = true;
        cell.range = {
            x: cell.x,
            y: cell.y,
            w: cell.size,
            h: cell.size
        };
        this.cells.push(cell);
        this.finder.insert(cell);
        cell.onSpawned();
        this.handle.gamemode.onNewCell(cell);
    }
    /** @param {Cell} cell */
    setCellAsBoosting(cell) {
        if (cell.isBoosting) return false;
        cell.isBoosting = true;
        this.boostingCells.push(cell);
        return true;
    }
    /** @param {Cell} cell */
    setCellAsNotBoosting(cell) {
        if (!cell.isBoosting) return false;
        cell.isBoosting = false;
        this.boostingCells.splice(this.boostingCells.indexOf(cell), 1);
        return true;
    }
    /** @param {Cell} cell */
    updateCell(cell) {
        cell.range.x = cell.x;
        cell.range.y = cell.y;
        cell.range.w = cell.size;
        cell.range.h = cell.size;
        this.finder.update(cell);
    }
    /** @param {Cell} cell */
    removeCell(cell) {
        this.handle.gamemode.onCellRemove(cell);
        cell.onRemoved();
        this.finder.remove(cell);
        delete cell.range;
        this.setCellAsNotBoosting(cell);
        // console.log(this.cells.length)
        unordered_remove(this.cells, this.cells.indexOf(cell))
        // this.cells.splice(this.cells.indexOf(cell), 1);
        cell.exists = false;
    }

    /** @param {Player} player */
    addPlayer(player) {
        this.players.push(player);
        player.world = this;
        player.hasWorld = true;
        this.worldChat.add(player.connection);
        this.handle.gamemode.onPlayerJoinWorld(player, this);
        // обращается к игроку который еще не заспавнился
        // player.connection.onWorldSet(player);
        this.handle.logger.debug(`player ${player.id} has been added to world ${this.id}`);
        if (!player.connection.isExternal) return;
        for (let i = 0; i < this.settings.worldMinionsPerPlayer; i++)
            new Minion(player.connection);
    }
    /** @param {Player} player */
    removePlayer(player) {
        this.players.splice(this.players.indexOf(player), 1);
        this.handle.gamemode.onPlayerLeaveWorld(player, this);
        player.world = null;
        player.hasWorld = false;
        this.worldChat.remove(player.connection);
        while (player.ownedCells.length > 0)
            this.removeCell(player.ownedCells[0]);
        // player.router.onWorldReset();
        this.handle.logger.debug(`player ${player.id} has been removed from world ${this.id}`);
    }

    
    /** @param {Connection|Bot} router */
    addRouter(router) {
        this.routers.push(router);
        router.world = this;
        router.hasWorld = true;
        // this.worldChat.add(router.router);
        // this.handle.gamemode.onPlayerJoinWorld(router, this);
        // обращается к игроку который еще не заспавнился
        router.onWorldSet(router);
        this.handle.logger.debug(`router ${router} has been added to world ${this.id}`);
        // if (!router.router.isExternal) return;
        // for (let i = 0; i < this.settings.worldMinionsPerPlayer; i++)
        //     new Minion(router.router);
    }
    /** @param {Router} router */
    removeRouter(router) {
        this.routers.splice(this.routers.indexOf(router), 1);
        // this.handle.gamemode.onPlayerLeaveWorld(router, this);
        router.world = null;
        router.hasWorld = false;
        // this.worldChat.remove(router.router);
        // while (router.ownedCells.length > 0)
        //     this.removeCell(router.ownedCells[0]);
        router.onWorldReset();
        this.handle.logger.debug(`player ${router} has been removed from world ${this.id}`);
    }

    /**
     * @param {number} cellSize
     * @returns {Point}
     */
    getRandomPos(cellSize) {
        return {
            x: this.border.x - this.border.w + cellSize + Math.random() * (2 * this.border.w - cellSize),
            y: this.border.y - this.border.h + cellSize + Math.random() * (2 * this.border.h - cellSize),
        };
    }
    /**
     * @param {Rect} range
     */
    isSafeSpawnPos(range) {
        return !this.finder.containsAny(range, /** @param {Cell} item */ (item) => item.avoidWhenSpawning);
    }
    /**
     * @param {number} cellSize
     * @returns {Point}
     */
    getSafeSpawnPos(cellSize) {
        let tries = this.settings.worldSafeSpawnTries;
        while (--tries >= 0) {
            const pos = this.getRandomPos(cellSize);
            if (this.isSafeSpawnPos({ x: pos.x, y: pos.y, w: cellSize, h: cellSize }))
                return pos;
        }
        return this.getRandomPos(cellSize);
    }
    /**
     * @param {number} cellSize
     * @param {Point} [target]
     * @returns {{ color: number, pos: Point }}
     */
    getPlayerSpawn(cellSize, target) {
        const PLAYER_SAFE_SPAWN_RADIUS = 1
        const safeRadius = cellSize * PLAYER_SAFE_SPAWN_RADIUS;

        if (target) {
            // const { viewportX: vx, viewportY: vy } = target;
            // const [bx_min, bx_max, by_min, by_max] = target.box;
            
            // const tries = 10;
            // const f1 = Math.max(this.options.PLAYER_VIEW_MIN, 2 * (vx - bx_min));
            // const f2 = Math.max(this.options.PLAYER_VIEW_MIN, 2 * (bx_max - vx));
            // const f3 = Math.max(this.options.PLAYER_VIEW_MIN, 2 * (vy - by_min));
            // const f4 = Math.max(this.options.PLAYER_VIEW_MIN, 2 * (by_max - vy));
            // let i = 0;
            // while (++i < tries) {
            //     const f = 0.5 + 0.5 * i / tries;
            //     const xmin = vx - f * f1;
            //     const xmax = vx + f * f2;
            //     const ymin = vy - f * f3;
            //     const ymax = vy + f * f4;
            //     const [x, y] = this.randomPoint(cellSize, xmin, xmax, ymin, ymax);
            //     if (this.wasm.is_safe(0, x, y, safeRadius, this.treePtr, this.stackPtr, this.options.IGNORE_TYPE) > 0)
            //         return [x, y, true, i];
            // }
            // return [0, 0, false, i];
            console.log(target)
            return { color: null, pos: { x: target.x, y: target.y } }
        }
        if (this.settings.worldSafeSpawnFromEjectedChance > Math.random() && this.ejectedCells.length > 0) {
            let tries = this.settings.worldSafeSpawnTries;
            while (--tries >= 0) {
                const cell = this.ejectedCells[~~(Math.random() * this.ejectedCells.length)];
                if (this.isSafeSpawnPos({ x: cell.x, y: cell.y, w: cellSize, h: cellSize })) {
                    this.removeCell(cell);
                    return { color: cell.color, pos: { x: cell.x, y: cell.y } };
                }
            }
        }
        return { color: null, pos: this.getSafeSpawnPos(cellSize) };
    }
    getNearPlayerSpawn(cellSize) {
        if (this.settings.worldSafeSpawnFromEjectedChance > Math.random() && this.ejectedCells.length > 0) {
            let tries = this.settings.worldSafeSpawnTries;
            while (--tries >= 0) {
                const cell = this.ejectedCells[~~(Math.random() * this.ejectedCells.length)];
                if (this.isSafeSpawnPos({ x: cell.x, y: cell.y, w: cellSize, h: cellSize })) {
                    this.removeCell(cell);
                    return { color: cell.color, pos: { x: cell.x, y: cell.y } };
                }
            }
        }
        return { color: null, pos: this.getSafeSpawnPos(cellSize) };
    }
    /**
     * @param {Player} player
     * @param {Point} pos
     * @param {number} size
     */
    spawnPlayer(player, pos, size) {
        const playerCell = new PlayerCell(player, pos.x, pos.y, size);
        this.addCell(playerCell);
        player.updateState(0);
    }

    update() {
        this.frozen ? this.frozenUpdate() : this.liveUpdate();
    }

    frozenUpdate() {
        for (let i = 0, l = this.players.length; i < l; i++) {
            const player = this.players[i];
            const router = this.players[i].connection;
            player.splitAttempts = 0;
            player.ejectAttempts = 0;
            if (router.isPressingQ) {
                if (!router.hasProcessedQ)
                    router.onQPress();
                router.hasProcessedQ = true;
            } else router.hasProcessedQ = false;
            router.requestingSpectate = false;
            player.spawningName = null;
        }
    }

    /**
     * 1. Reset all flags
     * 2. Add new objects
     * 3. Move boosting cells
     * 4. Resolve eat, resolve pushing boosting cells
     * 5. Player cells
     *    - Move
     *    - Decay
     *    - Autosplits
     *    - Bounce
     *    - Update in quadtree
     * 6. Resolve eat, pushing cells
     * 7. Find largest player
     * 8. Resolve inputs
     * 
     */

    liveUpdate() {
        this.handle.gamemode.onWorldTick(this);

        /** @type {Cell[]} */
        const eat = [];
        /** @type {Cell[]} */
        const rigid = [];
        /** @type {number} */
        let i;
        /** @type {number} */
        let l;
        // 1. Reset all flags
        for (i = 0, l = this.cells.length; i < l; i++)
            this.cells[i].onTick();
        // 2. Add new objects
        while (this.pelletCount < this.settings.pelletCount) {
            const pos = this.getSafeSpawnPos(this.settings.pelletMinSize);
            this.addCell(new Pellet(this, this, pos.x, pos.y));
        }
        while (this.virusCount < this.settings.virusMinCount) {
            const pos = this.getSafeSpawnPos(this.settings.virusSize);
            this.addCell(new Virus(this, pos.x, pos.y));
        }
        while (this.mothercellCount < this.settings.mothercellCount) {
            const pos = this.getSafeSpawnPos(this.settings.fuckercellSize);
            this.addCell(new Mothercell(this, pos.x, pos.y));
        }
      
        while (this.fuckercellCount < this.settings.fuckercellCount) {
            const pos = this.getSafeSpawnPos(this.settings.mothercellSize);
            this.addCell(new Fuckercell(this, pos.x, pos.y));
        }
        // 3. Move boosting cells
        for (i = 0, l = this.boostingCells.length; i < l;) {
            if (!this.boostCell(this.boostingCells[i])) l--;
            else i++;
        }
        // 4. Resolve eat, resolve pushing boosting cells
        for (i = 0; i < l; i++) {
            const cell = this.boostingCells[i];
            if (cell.type !== 2 && cell.type !== 3) continue; 
            this.finder.search(cell.range, (other) => {
                if (cell.id === other.id) return;
                const result = cell.getEatResult(other);
                switch (result) {
                    case 1: rigid.push(cell, other); break;
                    case 2: eat.push(cell, other); break;
                    case 3: eat.push(other, cell); break;
                }
            });
        }
        // 5. Player cells
        for (i = 0, l = this.playerCells.length; i < l; i++) {
            const cell = this.playerCells[i];
            this.movePlayerCell(cell);
            this.decayPlayerCell(cell);
            this.autosplitPlayerCell(cell);
            this.bounceCell(cell);
            this.updateCell(cell);
        }
        // 6. Resolve eat, pushing cells
        for (i = 0, l = this.playerCells.length; i < l; i++) {
            const cell = this.playerCells[i];
            this.finder.search(cell.range, (other) => {
                if (cell.id === other.id) return;
                const result = cell.getEatResult(other);
                switch (result) {
                    case 1: rigid.push(cell, other); break;
                    case 2: eat.push(cell, other); break;
                    case 3: eat.push(other, cell); break;
                }
            });
        }

        for (i = 0, l = rigid.length; i < l;)
            this.resolveRigidCheck(rigid[i++], rigid[i++]);
        for (i = 0, l = eat.length; i < l;)
            this.resolveEatCheck(eat[i++], eat[i++]);
        // 7. Find largest player
        this.largestPlayer = null;
        for (i = 0, l = this.players.length; i < l; i++) {
            const player = this.players[i];
            if (!isNaN(player.score) && (this.largestPlayer === null || player.score > this.largestPlayer.score))
                this.largestPlayer = player;
        }

        // 7.5 Resolve router inputs
        for (i = 0, l = this.players.length; i < l; i++) {}

        // 8. Resolve inputs
        const maxTickPerEject = 1 / this.settings.playerEjectDelay;
        for (i = 0, l = this.players.length; i < l; i++) {
            const player = this.players[i];
            player.checkExistence();
            if (!player.exists) { i--; l--; continue; }
            if (player.state === 1 && this.largestPlayer == null)
                player.updateState(2);
            const router_pl = player.connection;
            for (let j = 0, k = this.settings.playerSplitCap; j < k && player.splitAttempts > 0; j++) {
                router_pl.attemptSplit(player);
                player.splitAttempts--;
            }
            const nextEjectTick = this.handle.tick - this.settings.playerEjectDelay;
            if (player.ejectAttempts > 0/* && nextEjectTick >= player.ejectTick*/) {
                const maxPerTick = ~~((nextEjectTick / player.ejectTick) / this.settings.playerEjectDelay);
                let ejectAttempts = player.ejectAttempts > maxPerTick ? maxPerTick: player.ejectAttempts;
                while(ejectAttempts--){
                    router_pl.attemptEject(player);
                }
                player.ejectAttempts = 0
                player.ejectTick = this.handle.tick;
            }
            if (player.ejectMacroPressed) {
                if(player.ejectMacroProcessed == false){
                    player.ejectTick = this.handle.tick
                    player.ejectMacroProcessed = true
                }
                const протикало_с_последнего_выброса = this.handle.tick - player.ejectTick
                let maxEjectedPerTick = ~~(протикало_с_последнего_выброса * maxTickPerEject);//0.5 // пол тика в один выброс
                if(maxEjectedPerTick>=1){
                    while(maxEjectedPerTick--){
                        router_pl.attemptEject(player);
                    }
                    player.ejectTick = this.handle.tick;
                }

            }
            if (router_pl.isPressingQ) {
                if (!router_pl.hasProcessedQ)
                    router_pl.onQPress();
                router_pl.hasProcessedQ = true;
            } else router_pl.hasProcessedQ = false;
            if (router_pl.requestingSpectate) {
                router_pl.onSpectateRequest();
                router_pl.requestingSpectate = false;
            }
            if (player.spawningName !== null) {
                player.onSpawnRequest();
                player.spawningName = null;
            }
            player.updateViewArea();
        }

        this.compileStatistics();
        this.handle.gamemode.compileLeaderboard(this);

        if (this.stats.external <= 0 && Object.keys(this.handle.worlds).length > this.settings.worldMinCount)
            this.handle.removeWorld(this.id);
    }

    /**
     * @param {Cell} a
     * @param {Cell} b
     */
    resolveRigidCheck(a, b) {
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        const m = a.size + b.size - d;
        if (m <= 0) return;
        if (d === 0) d = 1, dx = 1, dy = 0;
        else dx /= d, dy /= d;
        const M = a.squareSize + b.squareSize;
        const aM = b.squareSize / M;
        const bM = a.squareSize / M;
        a.x -= dx * m * aM;
        a.y -= dy * m * aM;
        b.x += dx * m * bM;
        b.y += dy * m * bM;

        this.updateCell(a);
        this.updateCell(b);
        this.bounceCell(a);
        this.bounceCell(b);
        
        

        // let dx = b.x - a.x;
        // let dy = b.y - a.y;
        // let d = Math.sqrt(dx * dx + dy * dy);
        // var r = a.size + b.size; // radius sum of cell & check
        // var push = Math.min((r - d) / d, r - d); // min extrusion force
        // if (push / r < 0) return;
        // // body impulse
        // var ms = a.squareSize + b.squareSize;
        // //ms/=.5
        // //push*=1.9
        // ms/=.2
        // push*=3.9
        // var m1 = push * (b.squareSize / ms);
        // var m2 = push * (a.squareSize / ms);
        // // apply extrusion force
        // a.x -= dx * m1;
        // a.y -= dy * m1;
        // b.x += dx * m2;
        // b.y += dy * m2;
        // this.updateCell(a);
        // this.updateCell(b);


        // this.bounceCell(a);
        // this.bounceCell(b);
    }

    /**
     * @param {Cell} a
     * @param {Cell} b
     */
    resolveEatCheck(a, b) {
        if (!a.exists || !b.exists) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > a.size - b.size / this.settings.worldEatOverlapDiv) return;
        if (!this.handle.gamemode.canEat(a, b)) return;
        a.whenAte(b);
        b.whenEatenBy(a);
        this.removeCell(b);
        this.updateCell(a);
    }

    /**
     * @param {Cell} cell
     */
    boostCell(cell) {
        const d = cell.boost.d / 9 * this.handle.stepMult;
        cell.x += cell.boost.dx * d;
        cell.y += cell.boost.dy * d;
        this.bounceCell(cell, true);
        this.updateCell(cell);
        if ((cell.boost.d -= d) >= 1) return true;
        this.setCellAsNotBoosting(cell);
        return false;
    }

    /**
     * @param {Cell} cell
     * @param {boolean=} bounce
     */
    bounceCell(cell, bounce) {
        const r = cell.size / 2;
        const b = this.border;
        if (cell.x <= b.x - b.w + r) {
            cell.x = b.x - b.w + r;
            if (bounce) cell.boost.dx = -cell.boost.dx;
        }
        if (cell.x >= b.x + b.w - r) {
            cell.x = b.x + b.w - r;
            if (bounce) cell.boost.dx = -cell.boost.dx;
        }
        if (cell.y <= b.y - b.h + r) {
            cell.y = b.y - b.h + r;
            if (bounce) cell.boost.dy = -cell.boost.dy;
        }
        if (cell.y >= b.y + b.h - r) {
            cell.y = b.y + b.h - r;
            if (bounce) cell.boost.dy = -cell.boost.dy;
        }
    }

    /**
     * @param {Virus} virus
     */
    splitVirus(virus) {
        const newVirus = new Virus(this, virus.x, virus.y);
        newVirus.boost.dx = Math.sin(virus.splitAngle);
        newVirus.boost.dy = Math.cos(virus.splitAngle);
        newVirus.boost.d = this.settings.virusSplitBoost;
        this.addCell(newVirus);
        this.setCellAsBoosting(newVirus);
    }

    /**
     * @param {PlayerCell} cell
     */
    movePlayerCell(cell) {
        const router = cell.owner.connection;
        const player = cell.owner;
        if (router.disconnected) return;
        let dx = player.mouseX - cell.x;
        let dy = player.mouseY - cell.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) return; dx /= d; dy /= d;
        const m = Math.min(cell.moveSpeed, d) * this.handle.stepMult;
        cell.x += dx * m;
        cell.y += dy * m;
    }
    /**
     * @param {PlayerCell} cell
     */
    decayPlayerCell(cell) {
        const newSize = cell.size - cell.size * this.handle.gamemode.getDecayMult(cell) / 50 * this.handle.stepMult;
        cell.size = Math.max(newSize, this.settings.playerMinSize);
    }
    /**
     * @param {PlayerCell} cell
     * @param {number} size
     * @param {Boost} boost
     */
    launchPlayerCell(cell, size, boost) {
        cell.squareSize -= size * size;
        const x = cell.x + this.settings.playerSplitDistance * boost.dx;
        const y = cell.y + this.settings.playerSplitDistance * boost.dy;
        const newCell = new PlayerCell(cell.owner, x, y, size);
        newCell.boost.dx = boost.dx;
        newCell.boost.dy = boost.dy;
        newCell.boost.d = boost.d;
        this.addCell(newCell);
        this.setCellAsBoosting(newCell);
    }
    /**
     * @param {PlayerCell} cell
     */
    autosplitPlayerCell(cell) {
        const minSplit = this.settings.playerMaxSize * this.settings.playerMaxSize;
        const cellsLeft = 1 + this.settings.playerMaxCells - cell.owner.ownedCells.length;
        const overflow = Math.ceil(cell.squareSize / minSplit);
        if (overflow === 1 || cellsLeft <= 0) return;
        const splitTimes = Math.min(overflow, cellsLeft);
        const splitSize = Math.min(Math.sqrt(cell.squareSize / splitTimes), this.settings.playerMaxSize);
        for (let i = 1; i < splitTimes; i++) {
            const angle = Math.random() * 2 * Math.PI;
            this.launchPlayerCell(cell, splitSize, {
                dx: Math.sin(angle),
                dy: Math.cos(angle),
                d: this.settings.playerSplitBoost
            });
        }
        cell.size = splitSize;
    }

    /**
     * @param {Player} player
     */
    splitPlayer(player) {
        const l = player.ownedCells.length;
        let i = 0;
        for (; i < l; i++) {
            if (player.ownedCells.length >= this.settings.playerMaxCells)
                break;
            const cell = player.ownedCells[i];
            if (cell.size < this.settings.playerMinSplitSize)
                continue;
            let dx = player.mouseX - cell.x;
            let dy = player.mouseY - cell.y;
            let d = Math.sqrt(dx * dx + dy * dy);
            if (d < 1) dx = 1, dy = 0, d = 1;
            else dx /= d, dy /= d;
            this.launchPlayerCell(cell, cell.size / this.settings.playerSplitSizeDiv, {
                dx: dx,
                dy: dy,
                d: this.settings.playerSplitBoost
            });
        }
        return i
    }
    /**
     * @param {Player} player
     */
    ejectFromPlayer(player) {
        const dispersion = this.settings.ejectDispersion;
        const loss = this.settings.ejectingLoss * this.settings.ejectingLoss;
        const router = player.connection;
        const l = player.ownedCells.length;
        let ejected = 0
        for (let i = 0; i < l; i++) {
            const cell = player.ownedCells[i];
            if (cell.size < this.settings.playerMinEjectSize)
                continue;
            ejected++
            let dx = player.mouseX - cell.x;
            let dy = player.mouseY - cell.y;
            let d = Math.sqrt(dx * dx + dy * dy);
            if (d < 1) dx = 1, dy = 0, d = 1;
            else dx /= d, dy /= d;
            const sx = cell.x + dx * cell.size;
            const sy = cell.y + dy * cell.size;
            const newCell = new EjectedCell(this, player, sx, sy, cell.color, cell);
            const a = Math.atan2(dx, dy) - dispersion + Math.random() * 2 * dispersion;
            newCell.boost.dx = Math.sin(a);
            newCell.boost.dy = Math.cos(a);
            newCell.boost.d = this.settings.ejectedCellBoost;
            this.addCell(newCell);
            this.setCellAsBoosting(newCell);
            cell.squareSize -= loss;
            this.updateCell(cell);
        }
        return ejected
    }

    /**
     * @param {PlayerCell} cell
     */
    popPlayerCell(cell) {
        const splits = this.distributeCellMass(cell);
        for (let i = 0, l = splits.length; i < l; i++) {
            const angle = Math.random() * 2 * Math.PI;
            this.launchPlayerCell(cell, Math.sqrt(splits[i] * 100), {
                dx: Math.sin(angle),
                dy: Math.cos(angle),
                d: this.settings.playerSplitBoost
            });
        }
        // при любом разбиении стабильная течка
        if(this.settings.playerExtraDecayEnabled && splits.length>0) {
            cell.owner.extraDecayMult+=(this.settings.playerExtraDecayVirusPopLoss+(cell.owner.extraDecayMult/100*80))
            //splits.length
        }
    }

    /**
     * @param {PlayerCell} cell
     * @returns {number[]}
     */
    distributeCellMass(cell) {
        const player = cell.owner;
        let cellsLeft = this.settings.playerMaxCells - player.ownedCells.length;
        if (cellsLeft <= 0) return [];
        let splitMin = this.settings.playerMinSplitSize;
        splitMin = splitMin * splitMin / 100;
        const cellMass = cell.mass;
        if (this.settings.virusMonotonePops) {
            const amount = Math.max(Math.floor(cellMass / splitMin), cellsLeft);
            const perPiece = cellMass / (amount + 1);
            return new Array(amount).fill(perPiece);
        }else if(cellMass>=142 && cellMass<=219){
            const amount = Math.max(Math.floor(cellMass / splitMin), cellsLeft);
            const perPiece = cellMass / (amount + 1);
            return new Array(amount).fill(perPiece);
        }
        if (cellMass / cellsLeft < splitMin) {
            let amount = 2, perPiece = NaN;
            while ((perPiece = cellMass / (amount + 1)) >= splitMin && amount * 2 <= cellsLeft)
                amount *= 2;
            return new Array(amount).fill(perPiece);
        }
        const splits = [];
        let nextMass = cellMass / 2;
        let massLeft = cellMass / 2;
        while (cellsLeft > 0) {
            if (nextMass / cellsLeft < splitMin) break;
            while (nextMass >= massLeft && cellsLeft > 1)
                nextMass /= 2;
            splits.push(nextMass);
            massLeft -= nextMass;
            cellsLeft--;
        }
        nextMass = massLeft / cellsLeft;
        return splits.concat(new Array(cellsLeft).fill(nextMass));
    }

    compileStatistics() {
        let internal = 0, external = 0, playing = 0, spectating = 0;
        for (let i = 0, l = this.players.length; i < l; i++) {
            const player = this.players[i];
            if (!player.connection.isExternal) { internal++; continue; }
            external++;
            if (player.state === 0) playing++;
            else if (player.state === 1 || player.state === 2)
                spectating++;
        }
        this.stats.limit = this.settings.listenerMaxConnections - this.handle.listener.connections.length + external;
        this.stats.internal = internal;
        this.stats.external = external;
        this.stats.playing = playing;
        this.stats.spectating = spectating;
        this.stats.name = this.settings.serverName;
        this.stats.gamemode = this.handle.gamemode.name;
        this.stats.loadTime = this.handle.averageTickTime / this.handle.stepMult;
        this.stats.uptime = Math.floor((Date.now() - this.handle.startTime.getTime()) / 1000);
    }
}

export default World;

import Router from "../sockets/Router"

