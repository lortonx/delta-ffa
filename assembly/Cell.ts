export const enum CellType {
    player = 0,
    pellet = 1,
    virus = 2,
    ejected = 3,
    fuckercell = 4,
    mothercell = 4,
}

// @ts-ignore
@unmanaged class Cell {
    world_id: u8 = 0;
    router_id: u16 = 0;
    player_id: u16 = 0;
    id: u32 = 0;
    type: u8 = 0;

    x: i32 = 0;
    y: i32 = 0;
    size: u16 = 0;
    color: u32 = 0xFF0000

    boost_dx: i32 = 0
    boost_dy: i32 = 0
    boost_d: u32 = 0

    changes: u16 = 0;
    // @ts-ignore
    @inline
    constructor(world_id:u8, x:i32, y:i32, size:u16, color:u32){
        this.world_id = world_id
        this.x = x
        this.y = y
        this.size = size
        this.color = color
    }
    @inline
    position(x: i32, y: i32):void{
        this.x = x
        this.y = y
    }
}
export default Cell