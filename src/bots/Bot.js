// @ts-check

import Router from "../sockets/Router";

/**
 * @abstract
*/
class Bot extends Router {
    /**
     * @param {import('../worlds/World').default} world
     */
    constructor(world) {
        super(world.handle.listener);
        this.createPlayer();
        world.addRouter(this)
        world.addPlayer(this.player);
    }

    static get isExternal() { return false; }

    close() {
        super.close();
        this.listener.handle.removePlayer(this.player.id);
        this.disconnected = true;
        this.disconnectionTick = this.listener.handle.tick;
    }
}

export default Bot;

// import World from "../worlds/World";