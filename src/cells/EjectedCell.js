// @ts-check

import Cell from "./Cell";

class EjectedCell extends Cell {
    /**
     * @param {World} world
     * @param {Player} owner
     * @param {number} x
     * @param {number} y
     * @param {number} color
     */
    constructor(world, owner, x, y, color, cellEjector) {
        const size = world.settings.ejectedSize;
        super(world, x, y, size, color);
        this.owner = owner;
        this.cellEjector = cellEjector
    }

    get type() { return Cell.types.ejected; }
    get isSpiked() { return false; }
    get isAgitated() { return false; }
    get avoidWhenSpawning() { return false; }

    /**
     * @param {Cell} other
     * @returns {CellEatResult}
     */
    getEatResult(other) {
        if (other.type === 2) return other.getEjectedEatResult(false);
        if (other.type === 4) return 3;
        if (other.type === Cell.types.ejected) {
            if (this.world.settings.ejectedNoCollision) return 0
            if (!other.isBoosting) other.world.setCellAsBoosting(other);
            return 1;
        }
        return 0;
    }

    onSpawned() {
        this.world.ejectedCells.push(this);
    }
    onRemoved() {
        this.world.ejectedCells.splice(this.world.ejectedCells.indexOf(this), 1);
    }
}

export default EjectedCell;

import World from "../worlds/World";
import Player from "../worlds/Player";