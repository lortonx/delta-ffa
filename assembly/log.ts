//@ts-ignore
@external("env", "log")
declare function f64(s: f64): void

//@ts-ignore
@external("env", "log")
declare function u32(s: u32): void

//@ts-ignore
@external("env", "console.log")
declare function ii32(s: i32): void

//@ts-ignore
@external("env", "log")
declare function string(s: string): void

export {
    f64,
    u32,
    ii32,
    string
}
