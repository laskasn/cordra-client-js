/*
 * Copyright (c) 2019 Corporation for National Research Initiatives;
 * All rights reserved.
 */

import { AuthTokens, Options, TokenRequest } from "./Interfaces.js";
import { EncryptionUtil } from "./EncryptionUtil.js";
import { Utf8 } from "../encoder/Utf8.js";
import { Base64 } from "../encoder/Base64.js";

export class AuthUtil {
    public static async buildAuthHeadersFromOptions(options?: Options, token?: string): Promise<Headers> {
        let headers = new Headers();
        if (token) {
            headers = this.addBearerTokenHeader(headers, token);
        } else if (options && (options.token || options.privateKey || options.password)) {
            if (options.token) {
                headers = this.addBearerTokenHeader(headers, options.token);
            } else if (options.privateKey) {
                const issuer = options.userId || options.username;
                if (issuer) {
                    const token = await EncryptionUtil.getBearerToken(issuer, options.privateKey);
                    headers = this.addBearerTokenHeader(headers, token);
                }
            } else if (options.password) {
                const user = options.userId || options.username;
                if (user) {
                    headers = this.addBasicAuthHeader(headers, user, options.password);
                }
            }
        }
        if (options && options.asUserId) headers.append('As-User', options.asUserId);
        return headers;
    }

    public static async createTokenRequest(options?: Options, token?: string): Promise<TokenRequest> {
        const tokenRequest: TokenRequest = {};
        if (token) {
            tokenRequest.token = token;
        } else if (options && (options.token || options.privateKey || options.password)) {
            if (options.token) {
                tokenRequest.token = options.token;
            } else if (options.privateKey) {
                const issuer = options.userId || options.username;
                if (issuer) {
                    tokenRequest.assertion = await EncryptionUtil.getBearerToken(issuer, options.privateKey);
                    tokenRequest.grant_type = "urn:ietf:params:oauth:grant-type:jwt-bearer";
                }
            } else if (options.password) {
                const user = options.userId || options.username;
                if (user) {
                    tokenRequest.username = user;
                    tokenRequest.password = options.password;
                    tokenRequest.grant_type = "password";
                }
            }
        }
        return tokenRequest;
    }

    public static addBasicAuthHeader(headers: Headers, username: string, password: string): Headers {
        const usernameColonPassword = username + ':' + password;
        const base64String = Base64.encode(Utf8.decode(usernameColonPassword));
        headers.append('Authorization', 'Basic ' + base64String);
        return headers;
    }

    public static addBearerTokenHeader(headers: Headers, token: string): Headers {
        headers.append('Authorization', 'Bearer ' + token);
        return headers;
    }

    public static retrieveAuthTokens(key: string): AuthTokens {
        const res = localStorage.getItem('CordraClient.authTokens-' + key);
        if (res) return JSON.parse(res);
        else return {};
    }
    
    public static storeAuthTokens(key: string, authTokens: AuthTokens): void {
        localStorage.setItem('CordraClient.authTokens-' + key, JSON.stringify(authTokens));
    }
}
