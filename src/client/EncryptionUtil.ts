import { Base64 } from "../encoder/Base64.js";
import { Utf8 } from "../encoder/Utf8.js";

export class EncryptionUtil {

    public static getBearerToken(issuer: string, privateKey: JsonWebKey): PromiseLike<string> {
        const format = 'jwk';
        const extractable = false;
        const usages = ['sign'];
        const algo = {
            name: 'RSASSA-PKCS1-v1_5',
            hash: { name: 'SHA-256' }
        };
        return crypto.subtle.importKey(format, privateKey, algo, extractable, usages)
            .then((resultKey: CryptoKey) => {
                const jwtHeader = { alg: 'RS256' };
                const jwtHeaderJson = JSON.stringify(jwtHeader);
                const jwtHeaderJsonBytes = Utf8.decode(jwtHeaderJson);
                const jwtHeaderJsonBase64 = Base64.encodeUrlSafe(jwtHeaderJsonBytes);

                const nowSeconds = Math.floor(Date.now() / 1000);
                const claims = {
                    iss : issuer,
                    sub : issuer,
                    jti : this.generateJti(),
                    iat : nowSeconds,
                    exp : nowSeconds + 600
                };
                const claimsJson = JSON.stringify(claims);
                const claimsJsonBytes = Utf8.decode(claimsJson);
                const claimsJsonBase64 = Base64.encodeUrlSafe(claimsJsonBytes);

                const thingToBeSigned = Utf8.decode(jwtHeaderJsonBase64 + '.' + claimsJsonBase64);

                return crypto.subtle.sign(algo.name, resultKey, thingToBeSigned)
                    .then((signature) => {
                        const sigAsString = Base64.encodeUrlSafe(new Uint8Array(signature));
                        return jwtHeaderJsonBase64 + '.' + claimsJsonBase64 + '.' + sigAsString;
                    });
            });
    }

    private static generateJti(len: number = 20): string {
        const arr = new Uint8Array(len / 2);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, this.dec2hex).join('');
    }

    private static dec2hex(dec: number): string {
        return ('0' + dec.toString(16)).substr(-2);
    }
}
