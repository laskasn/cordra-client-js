export const Utf16 = { decode, encode };

export function decode(str: string): Uint8Array {
    const arr = new Uint8Array(calcNumBytes(str));
    let pos = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        arr[pos++] = code >>> 8;
        arr[pos++] = code & 0xFF;
    }
    return arr;
}

function calcNumBytes(str: string): number {
    return str.length * 2;
}

export function encode(arr: Uint8Array): string {
    let res = '';
    let i;
    for (i = 0; i + 1 < arr.length; i += 2) {
        const code = (arr[i] << 8) | arr[i + 1];
        res += String.fromCharCode(code);
    }
    if (i < arr.length) res += String.fromCharCode(0xFFFD);
    return res;
}
