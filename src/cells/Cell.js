// @ts-check
import { throwIfBadNumber, throwIfBadOrNegativeNumber } from "../primitives/Misc";

const BITS = {
    posChanged: 0x0001,
    sizeChanged: 0x0002,
    colorChanged: 0x0004,
    nameChanged: 0x0008,
    skinChanged: 0x0010,
    unused_6: 0x0020,
    unused_7: 0x0040,
    unused_8: 0x0080,
    unused_9: 0x0100,
    unused_10: 0x0200,
    unused_11: 0x0400,
    unused_12: 0x0800,
    unused_13: 0x1000,
    set: (
        /** @type {number} */ current, 
        /** @type {number} */ bit, 
        /** @type {boolean|number} */ state
    ) => state? (current |= bit) : (current &=~ bit)
}

/** @abstract */
class Cell {
    static types = {
        player: 0,
        pellet: 1,
        virus: 2,
        ejected: 3,
        fuckercell: 4,
        mothercell: 4,
    }
    /**
     * @param {import('../worlds/World').default} world
     * @param {number} x
     * @param {number} y
     * @param {number} size
     * @param {number} color
     */
    constructor(world, x, y, size, color) {
        this.world = world;
        /**@type {import("../primitives/QuadTree").default<import("../primitives/QuadTree").QuadItem<Cell>>} */
        this.__root = null

        this.id = world.nextCellId;
        this.birthTick = world.handle.tick;
        this.exists = false;
        /** @type {Cell} */
        this.eatenBy = null;
        /** @type {Rect} */
        this.range = null;
        this.isBoosting = false;
        this._canMerge = false
        /** @type {Boost} */
        this.boost = {
            dx: 0,
            dy: 0,
            d: 0
        };

        /** @type {import('../worlds/Player').default} */
        this.owner = null;
        /** @type {Cell} */
        this.cellEjector = null;

        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.name = null;
        this.skin = null;
        
        this.changes = 0x0000
        // this.posChanged =
        //     this.sizeChanged =
        //     this.colorChanged =
        //     this.nameChanged =
        //     this.skinChanged =
        //     false;
    }
    // @ts-ignore
    get posChanged(){return this.changes & BITS.posChanged}
    /** @param {boolean} state */
    set posChanged(state) { this.changes = BITS.set(this.changes, BITS.posChanged, state) }
    // @ts-ignore
    get sizeChanged(){return this.changes & BITS.sizeChanged}
    /** @param {boolean} state */
    set sizeChanged(state){this.changes = BITS.set(this.changes, BITS.sizeChanged, state) }
    // @ts-ignore
    get colorChanged(){return this.changes & BITS.colorChanged}
    /** @param {boolean} state */
    set colorChanged(state){this.changes = BITS.set(this.changes, BITS.colorChanged, state) }
    // @ts-ignore
    get nameChanged(){return this.changes & BITS.nameChanged}
    /** @param {boolean} state */
    set nameChanged(state){this.changes = BITS.set(this.changes, BITS.nameChanged, state) }
    // @ts-ignore
    get skinChanged(){return this.changes & BITS.skinChanged}
    /** @param {boolean} state */
    set skinChanged(state){this.changes = BITS.set(this.changes, BITS.skinChanged, state) }


    get canMerge() { return this._canMerge; }
    /**
     * @abstract
     * @returns {number}
     */
    get type() { throw new Error("Must be overriden"); }
    /**
     * @abstract
     * @returns {boolean}
     */
    get isSpiked() { throw new Error("Must be overriden"); }
    /**
     * @abstract
     * @returns {boolean}
     */
    get isAgitated() { throw new Error("Must be overriden"); }
    /**
     * @abstract
     * @returns {boolean}
     */
    get avoidWhenSpawning() { throw new Error("Must be overriden"); }
    /**
     * @virtual
     */
    get shouldUpdate() {
        return this.posChanged || this.sizeChanged ||
            this.colorChanged || this.nameChanged || this.skinChanged;
    }

    get age() { return (this.world.handle.tick - this.birthTick) * this.world.handle.stepMult; }
    /** @type {number} */
    get x() { return this._x; }
    /** @type {number} */
    get y() { return this._y; }
    set x(value) { throwIfBadNumber(value); this._x = value; this.posChanged = true; }
    set y(value) { throwIfBadNumber(value); this._y = value; this.posChanged = true; }

    /** @type {number} */
    get size() { return this._size; }
    set size(value) { throwIfBadOrNegativeNumber(value); this._size = value; this.sizeChanged = true; }

    /** @type {number} */
    get squareSize() { return this.size * this.size; }
    set squareSize(value) { this.size = Math.sqrt(value); }

    /** @type {number} */
    get mass() { return this.size * this.size / 100; }
    set mass(value) { this.size = Math.sqrt(100 * value); }

    /** @type {number} */
    get color() { return this._color; }
    set color(value) { this._color = value; this.colorChanged = true; }

    /** @type {string} */
    get name() { return this._name; }
    set name(value) { this._name = value; this.nameChanged = true; }

    /** @type {string} */
    get skin() { return this._skin; }
    set skin(value) { this._skin = value; this.skinChanged = true; }

    /**
     * @param {Cell} other
     * @returns {CellEatResult}
     */
    getEatResult(other) {
        throw new Error("Must be overriden");
    }
    /**
     * @param {boolean} other
     * @returns {CellEatResult}
     */
    getEjectedEatResult(other) {
        throw new Error("Must be overriden");
    }

    /**
     * @virtual
     */
    onSpawned() { }
    /**
     * @virtual
     */
    onTick() {
        this.changes = 0
        // this.posChanged =
        //     this.sizeChanged =
        //     this.colorChanged =
        //     this.nameChanged =
        //     this.skinChanged =
        //     false;
    }
    /**
     * @param {Cell} other
     * @virtual
     */
    whenAte(other) {
        this.squareSize += other.squareSize;
    }
    /**
     * @param {Cell} other
     * @virtual
     */
    whenEatenBy(other) {
        this.eatenBy = other;
    }
    /**
     * @virtual
     */
    onRemoved() { }
}

export default Cell;


import QuadTree from "../primitives/QuadTree";
// import Player from "../worlds/Player";
// import World from "../worlds/World";