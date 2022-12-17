import Cell from "./Cell"
import * as log from "./log";

export default class World{
    id: u8 = 0;
    cells: Array<Cell> = []
	constructor(){
		
        const dummyCell1 = new Cell(this.id, 14, 88, 600, 0)

        this.cells.push(dummyCell1)

        const dummyCell2 = new Cell(this.id, 13, 37, 800, 0)
        this.cells.push(dummyCell2)

	}
	sayHi():u16 {
        // let length = this.cells.length
        // while(length--) {
        //     const cell = this.cells[length]
        //     log.ii32(cell.x)
        //     log.ii32(cell.y)
        // }

        this.cells.forEach((cell, index) => {
            log.ii32(cell.x)
            log.ii32(cell.y)
        })

		return this.cells.length as u16
	}
}