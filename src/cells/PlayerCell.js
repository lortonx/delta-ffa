// @ts-check
const Cell = require("./Cell");

class PlayerCell extends Cell {
    /**
     * @param {Player} owner
     * @param {number} x
     * @param {number} y
     * @param {number} size
     */
    constructor(owner, x, y, size) {
        super(owner.world, x, y, size, owner.cellColor);
        this.owner = owner;
        this.name = owner.cellName || "";
        this.skin = owner.cellSkin || "";
        this.SPIKED = false
    }

    get moveSpeed() {
        return 88 * Math.pow(this.size, -0.4396754) * this.owner.settings.playerMoveMult;
    }

    get type() { return Cell.types.player; }
    get isSpiked() { return this.SPIKED; }
    get isAgitated() { return false; }
    get avoidWhenSpawning() { return true; }

    /**
     * @param {Cell} other
     * @returns {CellEatResult}
     */
    getEatResult(other) { 
        if (other.type === Cell.types.player) {
            const delay = this.world.settings.playerNoCollideDelay;
            if (other.owner.id === this.owner.id) {
                if (other.age < delay || this.age < delay) return 0;
                if (this.canMerge && other.canMerge) return 2;
                return 1;
            }
            if (other.owner.team === this.owner.team && this.owner.team !== null)
                return (other.age < delay || this.age < delay) ? 0 : 1;
            return this.getDefaultEatResult(other);
        }
        if (other.type === Cell.types.mothercell && other.size > this.size * this.world.settings.worldEatMult) return 3;
        if (other.type === Cell.types.pellet) return 2;
        if (other.type === Cell.types.ejected) {
            if(other.cellEjector.id === this.id && other.age < this.world.settings.ejectedNoCollideDelay ||
                 other.cellEjector.owner.id === this.owner.id && other.age < 1) return 0
        }
        return this.getDefaultEatResult(other);
    }
    /**
     * @param {Cell} other
     */
    getDefaultEatResult(other) {
        return other.size * this.world.settings.worldEatMult > this.size ? 0 : 2;
    }

    onTick() {
        super.onTick();

        if (this.name !== this.owner.cellName)
            this.name = this.owner.cellName;
        if (this.skin !== this.owner.cellSkin)
            this.skin = this.owner.cellSkin;
        if (this.color !== this.owner.cellColor)
            this.color = this.owner.cellColor;

        const settings = this.world.settings;
        let delay = settings.playerNoMergeDelay;
        if (settings.playerMergeTime > 0) {
            const increase = Math.round(25 * this.size * settings.playerMergeTimeIncrease);
            const initial = Math.round(25 * settings.playerMergeTime);
            delay = Math.max(delay, 
                settings.playerMergeVersion === "new" ? Math.max(initial, increase) : initial + increase
            );
        }
        this._canMerge = this.age >= delay;
    }

    onSpawned() {
        this.SPIKED = this.name===' '?true:false
        this.owner.connection.onNewOwnedCell(this);
        this.owner.ownedCells.push(this);
        this.world.playerCells.unshift(this);
    }

    onRemoved() {
        this.world.playerCells.splice(this.world.playerCells.indexOf(this), 1);
        this.owner.ownedCells.splice(this.owner.ownedCells.indexOf(this), 1);
        this.owner.updateState(-1);
    }
}

module.exports = PlayerCell;

const Player = require("../worlds/Player");
