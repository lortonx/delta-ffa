
import * as log from "./log";

import World from "./World";
export function add(a: i32, b: i32): i32 {
	return a + b + b;
}

const world = new World()

export function sayHi():u16{
	trace('SOSAT')
	return world.sayHi()
}