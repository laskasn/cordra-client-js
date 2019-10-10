export const Base64 = { decode, encode, encodeUrlSafe };

const un = undefined;

const base64DecodeArray = [
    un, un, un, un, un, un, un, un, un, un, un, un, un, un, un, un,
    un, un, un, un, un, un, un, un, un, un, un, un, un, un, un, un,
    un, un, un, un, un, un, un, un, un, un, un, 62, un, 62, un, 63,
    52, 53, 54, 55, 56, 57, 58, 59, 60, 61, un, un, un, un, un, un,
    un,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, un, un, un, un, 63,
    un, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
];

const base64EncodeArray = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
    'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
    'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/'
];

const base64UrlEncodeArray = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
    'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
    'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'
];

export function decode(s: string): Uint8Array {
    const res = new Uint8Array(calcNumBytes(s));
    let pos = 0;
    let inFour = 0;
    let accum = 0;
    for (let i = 0; i < s.length; i++) {
        const code = base64DecodeArray[s.charCodeAt(i)];
        if (code === undefined) continue;
        if (inFour === 0) {
            accum = code << 2;
        } else if (inFour === 1) {
            accum |= code >>> 4;
            res[pos++] = accum;
            accum = (code & 0x0F) << 4;
        }  else if (inFour === 2) {
            accum |= code >>> 2;
            res[pos++] = accum;
            accum = (code & 0x03) << 6;
        } else {
            accum |= code;
            res[pos++] = accum;
        }
        inFour = (inFour + 1) % 4;
    }
    return res.subarray(0, pos);
}

function calcNumBytes(str: string): number {
    let len = str.length;
    if (str[str.length - 1] === '=') {
        len -= 1;
        if (str[str.length - 2] === '=') len -= 1;
    }
    const mod = len % 4;
    if (mod === 0) return 3 * len / 4;
    if (mod === 1) return 3 * (len - 1) / 4;
    if (mod === 2) return 3 * (len - 2) / 4 + 1;
    return 3 * (len - 3) / 4 + 2;
}

function genericBase64EncoderFunction(arr: Uint8Array, thisBase64EncodeArray: Array<string>, usePad: boolean): string {
        let s = '';
        let accum = 0;
        let inThree = 0;
        for (let i = 0; i < arr.length; i++) {
            const code = arr[i];
            if (inThree === 0) {
                s += thisBase64EncodeArray[code >>> 2];
                accum = (code & 0x03) << 4;
            } else if (inThree === 1) {
                accum |= code >>> 4;
                s += thisBase64EncodeArray[accum];
                accum = (code & 0x0F) << 2;
            } else {
                accum |= code >>> 6;
                s += thisBase64EncodeArray[accum];
                s += thisBase64EncodeArray[code & 0x3F];
            }
            inThree = (inThree + 1) % 3;
        }
        if (inThree > 0) {
            s += thisBase64EncodeArray[accum];
            if (usePad) {
                const pad = '=';
                s += pad;
                if (inThree === 1) s += pad;
            }
        }
        return s;
}

export function encode(arr: Uint8Array): string {
    return genericBase64EncoderFunction(arr, base64EncodeArray, true);
}

export function encodeUrlSafe(arr: Uint8Array): string {
    return genericBase64EncoderFunction(arr, base64UrlEncodeArray, false);
}
