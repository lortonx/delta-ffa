// @ts-check



/**
 * @abstract
 */
class Protocol {
    /**
     * @param {Connection} connection
     */
    constructor(connection) {
        this.connection = connection;
    }

    /**
     * @abstract
     * @returns {string}
     */
    static get type() { throw new Error("Must be implemented"); }
    // @ts-ignore
    get type() { return this.constructor.type; }
    /**
     * @abstract
     * @returns {string}
     */
    get subtype() { throw new Error("Must be implemented"); }

    get listener() { return this.connection.listener; }
    get handle() { return this.connection.listener.handle; }
    get logger() { return this.connection.listener.handle.logger; }
    get settings() { return this.connection.listener.handle.settings; }

    /**
     * @abstract
     * @param {Reader} reader
     * @returns {boolean}
     */
    distinguishes(reader) { throw new Error("Must be implemented"); }

    /**
     * @abstract
     * @param {Reader} reader
     */
    onSocketMessage(reader) { throw new Error("Must be implemented"); }

    /**
     * @abstract
     * @param {ChatSource} source
     * @param {string} message
     */
    onChatMessage(source, message) { throw new Error("Must be implemented"); }
    /**
     * @abstract
     * @param {PlayerCell} cell
     */
    onNewOwnedCell(cell) { throw new Error("Must be implemented"); }
    /**
     * @param {Rect} rect
     * @param {boolean} includeServerInfo
     */
    onNewWorldBounds(rect, includeServerInfo) { throw new Error("Must be implemented"); }
    /**
     * @abstract
     */
    onWorldReset() { throw new Error("Must be implemented"); }
    /**
     * @abstract
     * @param {number} player_id
     */
    onNewOwnPlayer(player_id) {}
    /**
     * @abstract
     * @param {LeaderboardType} type
     * @param {LeaderboardDataType[type][]} data
     * @param {LeaderboardDataType[type]=} selfData
     */
    onLeaderboardUpdate(type, data, selfData) { throw new Error("Must be implemented"); }
    /**
     * @abstract
     * @param {ViewArea} viewArea
     */
    onSpectatePosition(viewArea) { throw new Error("Must be implemented"); }
    /**
     * @abstract
     * @param {Cell[]} add
     * @param {Cell[]} upd
     * @param {Cell[]} eat
     * @param {Cell[]} del
     */
    onVisibleCellUpdate(add, upd, eat, del) { throw new Error("Must be implemented"); }

    /**
     * @param {Buffer} data
     */
    send(data) { this.connection.send(data); }
    /**
     * @param {number|undefined} code
     * @param {string=} reason
     */
    fail(code, reason) {
        this.connection.closeSocket(code || 1003, reason || "Unspecified protocol fail");
    }
}

export default Protocol;

import Cell from "../cells/Cell";
import PlayerCell from "../cells/PlayerCell";
import Reader from "../primitives/Reader";
import Connection from "../sockets/Connection";