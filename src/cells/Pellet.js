// @ts-check
import * as Misc from "../primitives/Misc"
import Cell from "./Cell";

class Pellet extends Cell {
    /**
     * @param {World} world
     * @param {Spawner} spawner
     * @param {number} x
     * @param {number} y
     */
    constructor(world, spawner, x, y) {
        const size = world.settings.pelletMinSize;
        super(world, x, y, size, Misc.randomColor());

        this.spawner = spawner;
        this.lastGrowTick = this.birthTick;
    }

    get type() { return Cell.types.pellet; }
    get isSpiked() { return false; }
    get isAgitated() { return false; }
    get avoidWhenSpawning() { return false; }

    /**
     * @returns {CellEatResult}
     */
    getEatResult() { return 0; }

    onTick() {
        super.onTick();
        if (this._size >= this.world.settings.pelletMaxSize) return;
        if (this.world.handle.tick - this.lastGrowTick > this.world.settings.pelletGrowTicks / this.world.handle.stepMult) {
            this.lastGrowTick = this.world.handle.tick;
            this.mass++;
        }
    }
    onSpawned() {
        this.spawner.pelletCount++;
    }
    onRemoved() {
        this.spawner.pelletCount--;
    }
}

export default Pellet;

import World from "../worlds/World";
