export const Hex = { decode, encode };

const un = undefined;

const hexDecodeArray = [
    un, un, un, un, un, un, un, un, un, un, un, un, un, un, un, un,
    un, un, un, un, un, un, un, un, un, un, un, un, un, un, un, un,
    un, un, un, un, un, un, un, un, un, un, un, un, un, un, un, un,
    0,  1,  2,  3,  4,  5,  6,  7,  8,  9, un, un, un, un, un, un,
    un, 10, 11, 12, 13, 14, 15, 16, un, un, un, un, un, un, un, un,
    un, un, un, un, un, un, un, un, un, un, un, un, un, un, un, un,
    un, 10, 11, 12, 13, 14, 15, 16
];

const hexEncodeArray = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'
];

export function decode(str: string): Uint8Array {
    if (str.length % 2 !== 0) str = "0" + str;
    const res = new Uint8Array(calcNumBytes(str));
    let pos = 0;
    let inTwo = 0;
    let accum = 0;
    for (let i = 0; i < str.length; i++) {
        const code = hexDecodeArray[str.charCodeAt(i)];
        if (code === undefined) continue;
        if (inTwo === 0) {
            accum = code << 4;
        } else {
            accum |= code;
            res[pos++] = accum;
        }
        inTwo = (inTwo + 1) % 2;
    }
    return res.subarray(0, pos);
}

function calcNumBytes(str: string): number {
    return Math.floor(str.length / 2);
}

export function encode(arr: Uint8Array): string {
    let s = '';
    for (let i = 0; i < arr.length; i++) {
        const code = arr[i];
        s += hexEncodeArray[code >>> 4];
        s += hexEncodeArray[code & 0x0F];
    }
    return s;
}
