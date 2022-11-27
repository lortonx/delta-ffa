import Player from "../worlds/Player";


// @ts-check

class LastManStanding extends FFA {
    // @ts-ignore
    static get name() { return "Last Man Standing"; }
    static get type() { return 0; }

    /**
     * @param {World} world
     */
    canJoinWorld(world) {
        return world.hadPlayers;
    }
    /**
     * @param {World} world
     */
    onNewWorld(world) {
        world.hadPlayers = false;
    }
    /**
     * @param {Player} player
     * @param {World} world
     */
    onPlayerJoinWorld(player, world) {
        world.hadPlayers = true;
        if (player.connection.isExternal)
            player.life = 0;
    }
    /**
     * @param {Player} player
     * @param {string} name
     * @param {string} skin
     */
    onPlayerSpawnRequest(player, name, skin) {
        if (player.connection.isExternal && player.life++ > 0)
            return void this.handle.listener.globalChat.directMessage(null, player.connection, "You cannot spawn anymore.");
        super.onPlayerSpawnRequest(player, name, skin);
    }
}

export default LastManStanding;

import World from "../worlds/World";
import FFA from "./FFA";