// @ts-check
import { CommandList } from "./commands/CommandList";
import GamemodeList from "./gamemodes/GamemodeList";
import Logger from "./primitives/Logger";
import { version } from "./primitives/Misc";
import Stopwatch from "./primitives/Stopwatch";
import Ticker from "./primitives/Ticker";
import ProtocolStore from "./protocols/ProtocolStore";
import Settings from "./Settings";
import Listener from "./sockets/Listener";
import Matchmaker from "./worlds/Matchmaker";
import Player from "./worlds/Player";
import World from "./worlds/World";


class ServerHandle {
    /**
     * @param {Settings} settings
     */
    constructor(settings) {
        /** @type {Settings} */
        this.settings = Settings;

        this.protocols = new ProtocolStore();
        this.gamemodes = new GamemodeList(this);
        /** @type {Gamemode} */
        this.gamemode = null;
        this.commands = new CommandList(this);
        this.chatCommands = new CommandList(this);

        this.running = false;
        /** @type {Date} */
        this.startTime = null;
        this.averageTickTime = NaN;
        this.tick = NaN;
        this.tickDelay = NaN;
        this.stepMult = NaN;

        this.ticker = new Ticker(40);
        this.ticker.add(this.onTick.bind(this));
        this.stopwatch = new Stopwatch();
        this.logger = new Logger();

        this.listener = new Listener(this);
        this.matchmaker = new Matchmaker(this);
        /** @type {Identified<World>} */
        this.worlds = { };
        /** @type {Identified<Player>} */
        this.players = { };

        this.setSettings(settings);
    }

    get version() { return version; }

    /**
     * @param {Settings} settings
     */
    setSettings(settings) {
        this.settings = Object.assign({ }, Settings, settings);
        this.tickDelay = 1000 / this.settings.serverFrequency;
        this.ticker.step = this.tickDelay;
        this.stepMult = this.tickDelay / 40;
    }

    start() {
        if (this.running) return false;
        this.logger.inform("starting");

        this.gamemodes.setGamemode(this.settings.serverGamemode);
        this.startTime = new Date();
        this.averageTickTime = this.tick = 0;
        this.running = true;

        this.listener.open();
        this.ticker.start();
        this.gamemode.onHandleStart();

        this.logger.inform("ticker begin");
        this.logger.inform(`OgarII ${this.version}`);
        this.logger.inform(`gamemode: ${this.gamemode.name}`);
      
        //console.log(this.commands.handle.commands.list.addbot.executor)//
        //setTimeout(()=>{this.commands.handle.commands.list.addbot.executor(this.commands.handle,this,['1','10'])},10000)
        return true;
    }

    stop() {
        if (!this.running) return false;
        this.logger.inform("stopping");

        if (this.ticker.running)
            this.ticker.stop();
        for (let id in this.worlds)
            this.removeWorld(+id);
        for (let id in this.players)
            this.removePlayer(+id);
        for (let i = 0, l = this.listener.routers.length; i < l; i++)
            this.listener.routers[i].close();
        this.gamemode.onHandleStop();
        this.listener.close();

        this.startTime = null;
        this.averageTickTime = this.tick = NaN;
        this.running = false;

        this.logger.inform("ticker stop");
        return true;
    }

    /** @returns {World} */
    createWorld() {
        let id = 0;
        while (this.worlds.hasOwnProperty(++id)) ;
        const newWorld = new World(this, id);
        this.worlds[id] = newWorld;
        this.gamemode.onNewWorld(newWorld);
        newWorld.afterCreation();
        this.logger.debug(`added a world with id ${id}`);
        return newWorld;
    }

    /**
     * @param {number} id
     * @returns {boolean}
     */
    removeWorld(id) {
        if (!this.worlds.hasOwnProperty(id)) return false;
        this.gamemode.onWorldDestroy(this.worlds[id]);
        this.worlds[id].destroy();
        delete this.worlds[id];
        this.logger.debug(`removed world with id ${id}`);
        return true;
    }

    /**
     * @param {Router} router
     * @returns {Player}
     */
    createPlayer(router) {
        let id = 0;
        while (this.players.hasOwnProperty(++id));
        // @ts-ignore
        const player = new Player(this, id, router);
        this.players[id] = player;
        router.player = player;
        this.gamemode.onNewPlayer(player);
        this.logger.debug(`added a player with id ${id}`);
        return player;
    }

    /**
     * @param {number} id
     * @returns {boolean}
     */
    removePlayer(id) {
        if (!this.players.hasOwnProperty(id)) return false;
        this.gamemode.onPlayerDestroy(this.players[id]);
        this.players[id].destroy();
        this.players[id].exists = false;
        delete this.players[id];
        this.logger.debug(`removed player with id ${id}`);
        return true;
    }

    onTick() {
        this.stopwatch.begin();
        this.tick++;

        for (let id in this.worlds)
            this.worlds[id].update();
        this.listener.update();
        this.matchmaker.update();
        this.gamemode.onHandleTick();

        this.averageTickTime = this.stopwatch.elapsed();
        this.stopwatch.stop();
    }
}

export default ServerHandle;

import Gamemode from "./gamemodes/Gamemode";
import Router from "./sockets/Router";
