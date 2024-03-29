// @ts-check
const IPv4MappedValidate = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

    export function randomColor() {
        switch (~~(Math.random() * 6)) {
            case 0: return (~~(Math.random() * 0x100) << 16) | (0xFF << 8) | 0x10;
            case 1: return (~~(Math.random() * 0x100) << 16) | (0x10 << 8) | 0xFF;
            case 2: return (0xFF << 16) | (~~(Math.random() * 0x100) << 8) | 0x10;
            case 3: return (0x10 << 16) | (~~(Math.random() * 0x100) << 8) | 0xFF;
            case 4: return (0x10 << 16) | (0xFF << 8) | ~~(Math.random() * 0x100);
            case 5: return (0xFF << 16) | (0x10 << 8) | ~~(Math.random() * 0x100);
        }
    }
    /**
     * @param {{r:number,g:number,b:number}} color
     */
    export function grayscaleColor(color) {
        /** @type {number} */
        let weight;
        if (color) weight = ~~(0.299 * (color.r & 0xFF) + 0.587 * ((color.g >> 8) & 0xFF) + 0.114 * (color.b >> 16));
        else weight = 0x7F + ~~(Math.random() * 0x80);
        return (weight << 16) | (weight << 8) | weight;
    }
    /** @param {number[]} n */
    export function throwIfBadNumber(...n) {
        for (let i = 0; i < n.length; i++)
            if (isNaN(n[i]) || !isFinite(n[i]) || n[i] == null)
                throw new Error(`bad number (${n[i]}, index ${i})`);
    }
    /** @param {number[]} n */
    export function throwIfBadOrNegativeNumber(...n) {
        for (let i = 0; i < n.length; i++)
            if (isNaN(n[i]) || !isFinite(n[i]) || n[i] == null || n[i] < 0)
                throw new Error(`bad or negative number (${n[i]}, index ${i})`);
    }

    /**
     * @param {Rect} a
     * @param {Rect} b
     */
    export function intersects(a, b) {
        return a.x - a.w <= b.x + b.w &&
            a.x + a.w >= b.x - b.w &&
            a.y - a.h <= b.y + b.h &&
            a.y + a.h >= b.y - b.h;
    }
    /**
     * @param {Rect} a
     * @param {Rect} b
     */
    export function fullyIntersects(a, b) {
        return a.x - a.w >= b.x + b.w &&
               a.x + a.w <= b.x - b.w &&
               a.y - a.h >= b.y + b.h &&
               a.y + a.h <= b.y - b.h;
    }
    /**
     * @param {Rect} a
     * @param {Rect} b
     * @returns {Quadrant}
     */
    export function getQuadIntersect(a, b) {
        return {
            t: a.y - a.h < b.y || a.y + a.h < b.y,
            b: a.y - a.h > b.y || a.y + a.h > b.y,
            l: a.x - a.w < b.x || a.x + a.w < b.x,
            r: a.x - a.w > b.x || a.x + a.w > b.x
        };
    }
    /**
     * @param {Rect} a
     * @param {Rect} b
     */
    export function getQuadFullIntersect(a, b) {
        return (
            (a.y - a.h < b.y && a.y + a.h < b.y?0x1:0x0) |  // t
            (a.y - a.h > b.y && a.y + a.h > b.y?0x2:0x0) |  // b
            (a.x - a.w < b.x && a.x + a.w < b.x?0x4:0x0) |  // l
            (a.x - a.w > b.x && a.x + a.w > b.x?0x8:0x0)    // r
        )
    }

    /**
     * @param {string} a
     */
    export function filterIPAddress(a) {
        const unmapped = IPv4MappedValidate.exec(a);
        return unmapped ? unmapped[1] : a;
    }

    const version = "1.4.0"
    export {version}

