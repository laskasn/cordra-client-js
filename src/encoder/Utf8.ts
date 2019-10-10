export const Utf8 = { decode, encode, looksLikeBinary, stringLooksLikeBinary };

export function decode(str: string): Uint8Array {
    const res = new Uint8Array(calcNumBytes(str));
    let pos = 0;
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code <= 0x7F) {
            res[pos++] = code;
        } else if (code <= 0x7FF) {
            res[pos++] = 0xC0 | (code >>> 6);
            res[pos++] = 0x80 | (code & 0x3F);
        } else if (0xD800 <= code && code <= 0xDBFF) {
            if (i + 1 < str.length) {
                const next = str.charCodeAt(i + 1);
                if (0xDC00 <= next && next <= 0xDFFF) {
                    i++;
                    code = (((code - 0xD800) * 0x400) | (next - 0xDC00)) + 0x10000;
                    res[pos++] = 0xF0 | (code >>> 18);
                    res[pos++] = 0x80 | ((code >>> 12) & 0x3F);
                    res[pos++] = 0x80 | ((code >>> 6) & 0x3F);
                    res[pos++] = 0x80 | (code & 0x3F);
                    continue;
                }
            }
            // bare surrogate
            res[pos++] = 0xE0 | (code >>> 12);
            res[pos++] = 0x80 | ((code >>> 6) & 0x3F);
            res[pos++] = 0x80 | (code & 0x3F);
        } else {
            res[pos++] = 0xE0 | (code >>> 12);
            res[pos++] = 0x80 | ((code >>> 6) & 0x3F);
            res[pos++] = 0x80 | (code & 0x3F);
        }
    }
    return res;
}

function calcNumBytes(str: string): number {
    let res = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x7F) res += 1;
        else if (code <= 0x7FF) res += 2;
        else if (0xD800 <= code && code <= 0xDBFF) {
            if (i + 1 < str.length) {
                const next = str.charCodeAt(i + 1);
                if (0xDC00 <= next && next <= 0xDFFF) {
                    i++;
                    res += 4;
                    continue;
                }
            }
            // bare surrogate
            res += 3;
        } else res += 3;
    }
    return res;
}

export function encode(arr: Uint8Array): string {
    let str = '';
    for (let i = 0; i < arr.length; i++) {
        let code = arr[i];
        let thisValid = false;
        if (code <= 0x7F) {
            thisValid = true;
//            if(!binary && (code <= 0x08 || (0x0E <= code && code < 0x20) || code===0x7F)) binary = true;
            str += String.fromCharCode(code);
        } else if (code <= 0xC1 || code >= 0xF5) {
            thisValid = false;
        } else if (code <= 0xDF) {
            if (i + 1 < arr.length) {
                const c2 = arr[i + 1];
                if (0x80 <= c2 && c2 <= 0xBF) {
                    thisValid = true;
                    i++;
                    str += String.fromCharCode(((code & 0x1F) << 6) | (c2 & 0x3F));
                }
            }
        } else if (code <= 0xEF) {
            if (i + 2 < arr.length) {
                const c2 = arr[i + 1];
                const c3 = arr[i + 2];
                if (0x80 <= c2 && c2 <= 0xBF && 0x80 <= c3 && c3 <= 0xBF && !(code === 0xE0 && c2 <= 0x9F)) {
                    thisValid = true;
                    i += 2;
                    str += String.fromCharCode(((code & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F));
                }
            }
        } else {
            if (i + 3 < arr.length) {
                const c2 = arr[i + 1];
                const c3 = arr[i + 2];
                const c4 = arr[i + 3];
                if (0x80 <= c2 && c2 <= 0xBF && 0x80 <= c3 && c3 <= 0xBF && 0x80 <= c4 && c4 <= 0xBF && !(code === 0xF0 && c2 <= 0x8F)) {
                    code = ((code & 0x07) << 18) | ((c2 & 0x3F) << 12) | ((c3 & 0x3F) << 6) | (c4 & 0x3F);
                    if (code <= 0x10FFFF) {
                        thisValid = true;
                        i += 3;
                        code -= 0x10000;
                        str += String.fromCharCode(0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF));
                    }
                }
            }
        }
        if (!thisValid) {
            str += String.fromCharCode(0xFFFD);
        }
    }
    return str;
}

export function looksLikeBinary(arr: Uint8Array): boolean {
    for (let i = 0; i < arr.length; i++) {
        const code = arr[i];
        if (code <= 0x7F) {
            if (code <= 0x08 || (0x0E <= code && code < 0x20) || code === 0x7F) return true;
        } else if (code <= 0xC1 || code >= 0xF5) {
            return true;
        } else if (code <= 0xDF) {
            if (i + 1 >= arr.length) return true;
            const c2 = arr[++i];
            if (!(0x80 <= c2 && c2 <= 0xBF)) return true;
        } else if (code <= 0xEF) {
            if (i + 2 >= arr.length) return true;
            const c2 = arr[++i];
            const c3 = arr[++i];
            if (!(0x80 <= c2 && c2 <= 0xBF && 0x80 <= c3 && c3 <= 0xBF && !(code === 0xE0 && c2 <= 0x9F))) return true;
        } else {
            if (i + 3 >= arr.length) return true;
            const c2 = arr[++i];
            const c3 = arr[++i];
            const c4 = arr[++i];
            if (!(0x80 <= c2 && c2 <= 0xBF && 0x80 <= c3 && c3 <= 0xBF && 0x80 <= c4 && c4 <= 0xBF && !(code === 0xF0 && c2 <= 0x8F))) return true;
        }
    }
    return false;
}

export function stringLooksLikeBinary(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x08 || (0x0E <= code && code < 0x20) || code === 0x7F || code === 0xFFFD) return true;
    }
    return false;
}
