// @ts-check
const Cell = require("./Cell");
const Pellet = require("./Pellet");
const Virus = require("./Virus");
/**
 * @implements {Spawner}
 */
class Fuckercell extends Cell {
    /**
     * @param {World} world
     */
    constructor(world, x, y) {
        const size = world.settings.fuckercellSize;
        super(world, x, y, size, 0xCE6363);

        this.pelletCount = 0;
        this.activePelletFormQueue = 0;
        this.passivePelletFormQueue = 0;
    }

    get type() { return Cell.types.fuckercell; }
    get isSpiked() { return true; }
    get isAgitated() { return false; }
    get avoidWhenSpawning() { return true; }

    /**
     * @param {Cell} other
     * @returns {CellEatResult}
     */
    getEatResult(other) { return 0; }

    onTick() {
        const settings = this.world.settings;
        const fuckercellSize = settings.fuckercellSize;
        const pelletSize = settings.virusSize*3;
        const minSpawnSqSize = fuckercellSize * fuckercellSize + pelletSize * pelletSize;

        this.activePelletFormQueue += settings.fuckercellActiveSpawnSpeed * this.world.handle.stepMult;
        this.passivePelletFormQueue += Math.random() * settings.fuckercellPassiveSpawnChance * this.world.handle.stepMult;

        while (this.activePelletFormQueue > 0) {
            if (this.squareSize > minSpawnSqSize)
                this.spawnPellet(), this.squareSize -= pelletSize * pelletSize;
            else if (this.size > fuckercellSize)
                this.size = fuckercellSize;
            this.activePelletFormQueue--;
        }
        while (this.passivePelletFormQueue > 0) {
            if (this.pelletCount < settings.fuckercellMaxPellets)
                this.spawnPellet();
            this.passivePelletFormQueue--;
        }
    }
    spawnPellet() {
        const angle = Math.random() * 2 * Math.PI;
        const x = this.x + this.size+100 * Math.sin(angle);
        const y = this.y + this.size+100 * Math.cos(angle);

            /*const newD = this.boost.d + 780;
            this.boost.dx = (this.boost.dx * this.boost.d + cell.boost.dx * settings.virusPushBoost) / newD;
            this.boost.dy = (this.boost.dy * this.boost.d + cell.boost.dy * settings.virusPushBoost) / newD;
            this.boost.d = newD;
            this.world.setCellAsBoosting(this);*/
        //return
        const newVirus = new Virus(this.world, this.x, this.y);
        newVirus.boost.dx = Math.sin(angle);
        newVirus.boost.dy = Math.cos(angle);
              const d = this.world.settings.fuckercellPelletBoost;
        newVirus.boost.d = 10780//d//d / 2 + Math.random() * d / 2;//this.world.settings.virusSplitBoost;
        this.world.addCell(newVirus);
        this.world.setCellAsBoosting(newVirus);
        
        /*const pellet = new Pellet(this.world, this, x, y);
        pellet.boost.dx = Math.sin(angle);
        pellet.boost.dy = Math.cos(angle);
        const d = this.world.settings.fuckercellPelletBoost;
        pellet.boost.d = d / 2 + Math.random() * d / 2;
        this.world.addCell(pellet);
        this.world.setCellAsBoosting(pellet);*/
    }

    onSpawned() {
        this.world.fuckercellCount++;
    }
    whenAte(cell) {
        super.whenAte(cell);
        this.size = Math.min(this.size, this.world.settings.fuckercellMaxSize);
    }
    /**
     * @param {PlayerCell} cell
     */
    whenEatenBy(cell) {
        super.whenEatenBy(cell);
        if (cell.type === 0) this.world.popPlayerCell(cell);
    }
    onRemoved() {
        this.world.fuckercellCount--;
    }
}

module.exports = Fuckercell;

const World = require("../worlds/World");const PlayerCell = require("./PlayerCell");

