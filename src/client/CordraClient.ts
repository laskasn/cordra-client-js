/*
 * Copyright (c) 2019 Corporation for National Research Initiatives;
 * All rights reserved.
 */

import {
    AccessControlList,
    AuthResponse,
    AuthTokens,
    CordraObject,
    ErrorResponse,
    Options,
    QueryParams,
    SearchResults,
    VersionInfo
} from './Interfaces.js';
import { AuthUtil } from './AuthUtil.js';

import Keycloak from '../../node_modules/keycloak-js/dist/keycloak';


type ProgressCallback = (event: Event) => void;

export class CordraClient {

    private static readonly REFRESH_MS = 600000; // client-side auth token expiration

    /** The URI of the Cordra instance, including protocol */
    public baseUri: string;
    /** Set of default options to use with this client instance */
    public defaultOptions: Options;

    private authTokens: AuthTokens;

    public keycloakClient: any;


    public static async checkForErrors(response: Response | ErrorResponse): Promise<Response> {
        if ((response as Response).ok) return response as Response;
        const errorInfo = await CordraClient.getErrorMessageFromResponse(response);
        const errorResponse: ErrorResponse = {
            status: response.status,
            statusText: response.statusText,
            message: errorInfo.message,
            body: errorInfo.body
        };
        throw errorResponse;
    }

    private static async getErrorMessageFromResponse(response: Response | ErrorResponse): Promise<{message?: string, body?: object}> {
        if ((response as ErrorResponse).message) return response as ErrorResponse;
        const res: {message: string, body?: object} = { message: "Something went wrong." };
        if ((response as Response).text) {
            const responseText = await (response as Response).text();
            if (!responseText) {
                res.message = "Error: " + response.status + " " + response.statusText;
            } else {
                try {
                    const json = JSON.parse(responseText);
                    res.body = json;
                    if (json.message) {
                        res.message = json.message;
                    } else if (json.error_description) {
                        res.message = json.error_description;
                    } else if (json.error) {
                        res.message = json.error;
                    } else {
                        res.message = responseText;
                    }
                } catch (e) {
                    res.message = responseText;
                }
            }
        } else {
            res.message = "Something went wrong: " + response.status + " " + response.statusText;
        }
        return res;
    }

    private static returnJsonPromise(response: Response): Promise<any> {
        return response.json();
    }

    private static returnJsonOrUndefinedPromise(response: Response): Promise<any> {
        const contentType = response.headers.get("Content-Type");
        if (!contentType) {
            return Promise.resolve(undefined);
        } else {
            return response.json();
        }
    }

    private static ensureSlash(baseUri: string): string {
        if (baseUri.slice(-1) !== '/') {
            baseUri = baseUri + '/';
        }
        return baseUri;
    }

    private static getRangeHeader(start: number = -1, end: number = -1): string {
        if (start > -1 && end > -1) {
            return "bytes=" + start + "-" + end;
        } else if (start > -1 && end === -1) {
            return "bytes=" + start + "-";
        } else if (start === -1 && end > -1) {
            return "bytes=" + "-" + end;
        } else {
            return '';
        }
    }

    private static getEncodedWithSlashes(toEncode: string): string {
        return encodeURIComponent(toEncode).replace(/%2F/g, '/');
    }

    /**
     * Creates a Cordra Client, optionally setting default options.
     *
     * @param baseUri The URI of the Cordra instance, including protocol
     * @param options Set of default options to use with this client instance
     * @example
     * ```javascript
     *
     * // No default options
     * const httpsClient = new CordraClient("https://localhost:8443");
     *
     * // Setting default options
     * const options = {
     *   isDryRun: true
     * };
     * const httpClient = new CordraClient("http://localhost:8080/", options);
     * ```
     */
    constructor(baseUri: string, options?: Options) {
        this.baseUri = CordraClient.ensureSlash(baseUri);
        this.defaultOptions = options || {};
        this.authTokens = AuthUtil.retrieveAuthTokens(this.baseUri);

        if(this.defaultOptions != null && this.defaultOptions.keycloakConfig != null){
          this.keycloakClient = Keycloak(this.defaultOptions.keycloakConfig);
        }

    }


    /**
     * Builds a Headers object containing the authentication headers corresponding to the given options.
     *
     * @param options Options to use for this request
     */
    public async buildAuthHeaders(options: Options = this.defaultOptions): Promise<Headers> {
        const headersObj = await this.buildAuthHeadersReturnDetails(options);
        if (headersObj.unauthenticated) throw { message: "Unauthenticated" };
        return headersObj.headers;
    }

    private getCachedToken(userKey : string) : string | undefined {
        if (!userKey) return undefined;
        const tokenInfo = this.authTokens[userKey];
        if (!tokenInfo) return undefined;
        const now = Date.now();
        if (tokenInfo.lastUsed && (now - tokenInfo.lastUsed) <= CordraClient.REFRESH_MS) {
            tokenInfo.lastUsed = now;
            AuthUtil.storeAuthTokens(this.baseUri, this.authTokens);
            return tokenInfo.token;
        } else {
            delete this.authTokens[userKey];
            AuthUtil.storeAuthTokens(this.baseUri, this.authTokens);
            return undefined;
        }
    }

    public async buildAuthHeadersReturnDetails(options: Options = this.defaultOptions, acquireNewToken: boolean = true): Promise<{isStoredToken?: boolean, unauthenticated?: boolean, headers: Headers}> {

        //console.log("RUNNING buildAuthHeadersReturnDetails with params: ", options, acquireNewToken)
        if (!options) return { headers: new Headers() };
        if (options.token) return { isStoredToken: false, headers: await AuthUtil.buildAuthHeadersFromOptions(options) };
        const userKey = options.userId || options.username;
        if (!userKey) return { headers: await AuthUtil.buildAuthHeadersFromOptions(options) };
        const token = this.getCachedToken(userKey);
        if (token) return { isStoredToken: true, headers: await AuthUtil.buildAuthHeadersFromOptions(options, token) };
        if (!options.password && !options.privateKey) {
            // No stored credentials so cannot authenticate---was expecting a stored token
            return { unauthenticated: true, headers: await AuthUtil.buildAuthHeadersFromOptions(options) };
        }
        if (acquireNewToken) {
            const authResponse = await this.authenticate(options);
            return { isStoredToken: true, headers: await AuthUtil.buildAuthHeadersFromOptions(options, authResponse.access_token) };
        } else {
            return { headers: await AuthUtil.buildAuthHeadersFromOptions(options) };
        }
    }

    public async retryAfterTokenFailure<T>(options: Options, fetcher: (headers: Headers) => Promise<T>) : Promise<T> {
        const firstAuthHeadersObj = await this.buildAuthHeadersReturnDetails(options);
        if (firstAuthHeadersObj.unauthenticated) throw { message: "Unauthenticated" };
        if (!firstAuthHeadersObj.isStoredToken) return fetcher(firstAuthHeadersObj.headers);
        try {
            // necessary to await here in order for try/catch to work
            return await fetcher(firstAuthHeadersObj.headers);
        } catch (e) {
            if (e.status !== 401) throw e;
            const userKey = options.userId || options.username;
            if (!userKey) throw e;
            delete this.authTokens[userKey];
            const secondAuthHeaders = await this.buildAuthHeaders(options);
            return fetcher(secondAuthHeaders);
        }
    }



    /**
     * Authenticates using the given options.
     *
     * @param options Options to use for this request
     * @return The authentication response
     *
     * @example
     * ```javascript
     *
     * const authOptions = {
     *   username: 'admin',
     *   password: 'password'
     * };
     * const client = new CordraClient("https://localhost:8443");
     * client.authenticate(authOptions);
     * ```
     */
    public async authenticate(options: Options = this.defaultOptions): Promise<AuthResponse> {

        if(options.keycloakConfig != null ) {
          if(this.keycloakClient == null){
            this.keycloakClient = Keycloak(options.keycloakConfig);
          }
          const authResponse = await this.keycloakAuth();
          this.defaultOptions.token = authResponse.access_token;
          return authResponse;
        }
        else {
          const tokenRequest = await AuthUtil.createTokenRequest(options);
          const uri = this.baseUri + 'auth/token';
          const authResponse = await fetch(uri, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(tokenRequest)
          })
          .then(CordraClient.checkForErrors)
          .then(CordraClient.returnJsonPromise);
          if (!authResponse.active) {
              throw { message : 'Authorization failed' };
          }
          const userKey = options.userId || options.username;
          if (userKey) {
              const token = authResponse.access_token;
              this.authTokens[userKey] = { token, lastUsed: Date.now() };
              AuthUtil.storeAuthTokens(this.baseUri, this.authTokens);
          }
          return authResponse;

        }


    }




    private async keycloakAuth() : Promise<AuthResponse> {

      let keycloakClient = this.keycloakClient;
      let extractAuthResp = this.extractAuthResp;

      let initPromise = this.keycloakClient
          .init({
            onLoad: 'login-required',
            checkLoginIframe: false,
            //silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html'
          });

      return new Promise(function(resolve, reject) {
        initPromise.success((result:any) => {
          let response = extractAuthResp(keycloakClient);
          //keycloakClient.token
          resolve(response);
        })
        .error((e: any) => {
          console.log(e)
          reject(e);
        });
      });

    }



    private async getKeycloakAuthStatus() : Promise<AuthResponse>{

      const extractAuthResp = this.extractAuthResp;
      const keycloakClient = this.keycloakClient;
      return new Promise<any>(function(resolve, reject) {
        try{
          let authResp = extractAuthResp(keycloakClient);
          resolve(authResp);
        }
        catch(e){
          reject(e);
        }

      });


    }


    private extractAuthResp(keycloakClient : any) : AuthResponse {
      let authResp : AuthResponse;

      if(keycloakClient != null){
        authResp = {
          access_token : keycloakClient.token,
          token_type : keycloakClient.tokenParsed.typ,
          active : true,
          userId : keycloakClient.tokenParsed.sub,
          username : keycloakClient.tokenParsed.preferred_username
        }
      }
      else{
        authResp = {
          access_token : undefined,
          token_type : undefined,
          active : false,
          userId : undefined,
          username : undefined
        }
      }


      return authResp;
    }




    /**
     * Gets the authentication status for the supplied options. By default, returns active flag, userId, and username.
     *
     * @param full Whether to get full auth info, including types user can create and groups user is a member of
     * @param options Options to use for this request
     */
    public async getAuthenticationStatus(full: boolean = false, options: Options = this.defaultOptions): Promise<AuthResponse> {

        if(options.keycloakConfig != null){
          return this.getKeycloakAuthStatus();
        }

        const userKey = options.userId || options.username;
        const headersObj = await this.buildAuthHeadersReturnDetails(options, false);
        let uri = this.baseUri + 'check-credentials';
        if (full) {
            uri += '?full=true';
        }
        const resp = await fetch(uri, {
            method: 'GET',
            headers: headersObj.headers
        })
        .then(CordraClient.checkForErrors)
        .then(CordraClient.returnJsonPromise);
        if (headersObj.unauthenticated || !headersObj.isStoredToken || resp.active || !userKey) return resp;
        delete this.authTokens[userKey];
        const secondHeaders = await AuthUtil.buildAuthHeadersFromOptions(options);
        return fetch(uri, {
            method: 'GET',
            headers: secondHeaders
        })
        .then(CordraClient.checkForErrors)
        .then(CordraClient.returnJsonPromise);

    }

    /**
     * Requests a password change for the currently authenticated user.
     *
     * @param newPassword The new password
     * @param options Options to use for this request
     */
    public async changePassword(newPassword: string, options: Options): Promise<Response> {
        const uri = this.baseUri + 'users/this/password';
        const headers = await AuthUtil.buildAuthHeadersFromOptions(options);
        const resp = await fetch(uri, {
            method: 'PUT',
            headers,
            body: newPassword
        })
        .then(CordraClient.checkForErrors);
        const userKey = options.userId || options.username;
        if (userKey) {
            delete this.authTokens[userKey];
            AuthUtil.storeAuthTokens(this.baseUri, this.authTokens);
        }
        return resp;
    }

    /**
     * Requests a password change for the admin user.
     *
     * @param newPassword The new password
     * @param options Options to use for this request
     */
    public async changeAdminPassword(newPassword: string, options: Options): Promise<Response> {
        const uri = this.baseUri + 'adminPassword';
        const data = { password: newPassword };
        const headers = await AuthUtil.buildAuthHeadersFromOptions(options);
        const resp = await fetch(uri, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data, null, ' ')
        })
        .then(CordraClient.checkForErrors);
        delete this.authTokens['admin'];
        AuthUtil.storeAuthTokens(this.baseUri, this.authTokens);
        return resp;
    }

    /**
     * Deletes any stored authentication token locally, and revokes the token at the server.
     *
     * @param options Options to use for this request
     */
    public async signOut(options: Options = this.defaultOptions): Promise<AuthResponse> {

        if(options.token != null){
          this.keycloakClient.init({}).success((result:any) => {this.keycloakClient.logout({redirectUri: window.location.href}) })
        }

        const userKey = options.userId || options.username;
        if (!userKey) {
            return { active: false };
        }
        const token = this.getCachedToken(userKey);
        if (!token) {
            return { active: false };
        }
        const tokenRequest = await AuthUtil.createTokenRequest(options, token);
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        const uri = this.baseUri + 'auth/revoke';
        const resp = fetch(uri, {
            method: 'POST',
            headers,
            body: JSON.stringify(tokenRequest)
        })
        .then(CordraClient.checkForErrors)
        .then(CordraClient.returnJsonPromise);
        if (userKey) {
            delete this.authTokens[userKey];
            AuthUtil.storeAuthTokens(this.baseUri, this.authTokens);
        }
        return resp;
    }

    /**
     * Searches Cordra for objects matching a given query. The query format is that used by the indexing
     * backend, which is generally the inter-compatible Lucene/Solr/Elasticsearch format for fielded search.
     *
     * @param query The query string to search
     * @param params Parameters for this query
     * @param options Options to use for this request
     * @example
     * ```javascript
     *
     * // Search for all objects in Cordra
     * client.search("*:*");
     *
     * // Search for all schemas.
     * // Sort results in descending order by name and return 2 results
     * const params = {
     *   pageSize: 2,
     *   sortFields: [{name: "/name", reverse: true}]
     * };
     * client.search("type:Schema", params);
     *
     * // Search for everything that is not a schema.
     * // Sort results by type and then id
     * const params = {
     *   sortFields: [{name: "type"}, {name: "id"}]
     * };
     * client.search("*:* -type:Schema", params);
     * ```
     */
    public async search(query: string, params?: QueryParams, options: Options = this.defaultOptions): Promise<SearchResults> {
        if (!params) params = { pageNum: 0, pageSize: -1 };
        const uri = this.baseUri + 'objects?query=' + CordraClient.getEncodedWithSlashes(query) + '&' + this.encodeParams(params);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Searches Cordra for objects matching a given query. Returns the object IDs instead of full objects. The
     * query format is that used by the indexing backend, which is generally the inter-compatible
     * Lucene/Solr/Elasticsearch format for fielded search.
     *
     * @param query The query string to search
     * @param params Parameters for this query
     * @param options Options to use for this request
     */
    public async searchHandles(query: string, params?: QueryParams, options: Options = this.defaultOptions): Promise<SearchResults> {
        if (!params) params = { pageNum: 0, pageSize: -1 };
        const uri = this.baseUri + 'objects?ids&query=' + CordraClient.getEncodedWithSlashes(query) + '&' + this.encodeParams(params);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Retrieves a list of all objects in Cordra.
     *
     * @param options Options to use for this request
     */
    public list(options: Options = this.defaultOptions): Promise<SearchResults> {
        return this.search('*:*');
    }

    /**
     * Retrieves a list of the handles for all objects in Cordra.
     *
     * @param options Options to use for this request
     */
    public listHandles(options: Options = this.defaultOptions): Promise<SearchResults> {
        return this.searchHandles('*:*');
    }

    /**
     * Retrieves an object form Cordra by ID.
     *
     * @param id The ID of the object to retrieve
     * @param options Options to use for this request
     */
    public async get(id: string, options: Options = this.defaultOptions): Promise<CordraObject> {
        let uri = this.baseUri + 'objects/' + CordraClient.getEncodedWithSlashes(id) + '?full';
        if (options.includeResponseContext) uri += '&includeResponseContext';
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Creates a new object.
     *
     * @param cordraObject An object containing the type and content of the new object.
     * @param progressCallback Callback for progress notification
     * @param options Options to use for this request
     * @example
     * ```javascript
     *
     * const cordraObject = {
     *     type: "Document",
     *     content: { id: '', name: 'test doc' }
     * }
     * client.create(cordraObject);
     * ```
     */
    public async create(cordraObject: CordraObject, progressCallback?: ProgressCallback, options: Options = this.defaultOptions): Promise<CordraObject> {
        return this.createOrUpdate(cordraObject, true, progressCallback, options)
        .catch(CordraClient.checkForErrors);
    }

    /**
     * Updates an object.
     *
     * @param cordraObject An object containing the id of the object and the new content.
     * @param progressCallback Callback for progress notification
     * @param options Options to use for this request
     * @example
     * ```javascript
     *
     * const cordraObject = {
     *     id: "test/12345",
     *     content: { id: "test/12345", name: 'a different name' }
     * }
     * client.update(cordraObject);
     * ```
     */
    public async update(cordraObject: CordraObject, progressCallback?: ProgressCallback, options: Options = this.defaultOptions): Promise<CordraObject> {
        return this.createOrUpdate(cordraObject, false, progressCallback, options)
        .catch(CordraClient.checkForErrors);
    }

    /**
     * Deletes an object.
     *
     * @param id ID of the object to delete
     * @param options Options to use for this request
     */
    public async delete(id: string, options: Options = this.defaultOptions): Promise<Response> {
        const uri = this.baseUri + 'objects/' + CordraClient.getEncodedWithSlashes(id);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'DELETE',
                headers
            })
            .then(CordraClient.checkForErrors);
        });
    }

    /**
     * Retrieves the value of a property of an object.
     *
     * @param id ID of the object
     * @param propertyName Name of the property to retrieve
     * @param options Options to use for this request
     */
    public async getObjectProperty(id: string, propertyName: string, options: Options = this.defaultOptions): Promise<any> {
        const encodedJsonPointer = CordraClient.getEncodedWithSlashes(propertyName);
        const encodedId = CordraClient.getEncodedWithSlashes(id);
        let uri = this.baseUri + 'objects/' + encodedId + '?jsonPointer=' + encodedJsonPointer;
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Updates only the given property of an object.
     *
     * @param id ID of the object
     * @param propertyName Name of the property to update
     * @param payload Data to insert into object
     * @param options Options to use for this request
     */
    public async updateObjectProperty(id: string, propertyName: string, payload: any, options: Options = this.defaultOptions): Promise<CordraObject> {
        const encodedJsonPointer = CordraClient.getEncodedWithSlashes(propertyName);
        const encodedId = CordraClient.getEncodedWithSlashes(id);
        const uri = this.baseUri + 'objects/' + encodedId + '?jsonPointer=' + encodedJsonPointer;
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload, null, ' ')
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Generates a URI that can be used to download the payload of an object.
     *
     * @param id ID of the object
     * @param payloadName Name of the desired payload
     */
    public getPayloadDownloadLink(id: string, payloadName: string): string {
        const encodedId = CordraClient.getEncodedWithSlashes(id);
        const encodedPayloadName = CordraClient.getEncodedWithSlashes(payloadName);
        return this.baseUri + 'objects/' + encodedId + '?payload=' + encodedPayloadName;
    }

    /**
     * Gets a payload for an object.
     *
     * @param id ID of the object
     * @param payloadName Name of the desired payload
     * @param options Options to use for this request
     */
    public async getPayload(id: string, payloadName: string, options: Options = this.defaultOptions): Promise<Blob> {
        const uri = this.getPayloadDownloadLink(id, payloadName);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(resp => resp.blob());
        });
    }

    /**
     * Gets part of the payload of an object. This can be useful streaming payloads.
     *
     * @param id ID of the object
     * @param payloadName Name of the desired payload
     * @param start Beginning of payload range
     * @param end End of payload range
     * @param options Options to use for this request
     */
    public async getPartialPayload(id: string, payloadName: string, start: number, end: number, options: Options = this.defaultOptions): Promise<Blob> {
        const uri = this.getPayloadDownloadLink(id, payloadName);
        return await this.retryAfterTokenFailure(options, headers => {
            headers.append('Range', CordraClient.getRangeHeader(start, end));
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(resp => resp.blob());
        });
    }

    /**
     * Removes a payload from an object.
     *
     * @param object The object to be updated
     * @param payloadName Name of the desired payload
     * @param options Options to use for this request
     */
    public async deletePayload(object: CordraObject, payloadName: string, options: Options = this.defaultOptions): Promise<CordraObject> {
        if (object.payloads === undefined) return object;
        if (object.payloadsToDelete === undefined) object.payloadsToDelete = [];
        object.payloadsToDelete.push(payloadName);
        object.payloads = undefined; // We're just deleting payloads, so don't send current list to update.
        return this.update(object, undefined, options);
    }

    /**
     * Gets the access control list for an object.
     *
     * @param id ID of the object
     * @param options Options to use for this request
     */
    public async getAclForObject(id: string, options: Options = this.defaultOptions): Promise<AccessControlList> {
        const uri = this.baseUri + 'acls/' + CordraClient.getEncodedWithSlashes(id);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Updates the access control list for an object.
     *
     * @param id ID of the object
     * @param newAcl New ACL to set on object
     * @param options Options to use for this request
     */
    public async updateAclForObject(id: string, newAcl: object, options: Options = this.defaultOptions): Promise<AccessControlList> {
        const uri = this.baseUri + 'acls/' + CordraClient.getEncodedWithSlashes(id);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'PUT',
                headers,
                body: JSON.stringify(newAcl)
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Creates a new version snapshot of an object.
     *
     * @param id ID of the object
     * @param options Options to use for this request
     */
    public async publishVersion(id: string, options: Options = this.defaultOptions): Promise<VersionInfo> {
        const uri = this.baseUri + 'versions?objectId=' + CordraClient.getEncodedWithSlashes(id);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'POST',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Retrieves all version snapshots for an object.
     *
     * @param id ID of the object
     * @param options Options to use for this request
     */
    public async getVersionsFor(id: string, options: Options = this.defaultOptions): Promise<Array<VersionInfo>> {
        const uri = this.baseUri + 'versions?objectId=' + CordraClient.getEncodedWithSlashes(id);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Starts a background process to update all handles in the system. Used to propagate prefix changes.
     *
     * @param options Options to use for this request
     */
    public async updateAllHandles(options: Options = this.defaultOptions): Promise<Response> {
        const uri = this.baseUri + 'updateHandles';
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'POST',
                headers
            })
            .then(CordraClient.checkForErrors);
        });
    }

    /**
     * Gets status of handle update process.
     *
     * @param options Options to use for this request
     */
    public async getHandleUpdateStatus(options: Options = this.defaultOptions): Promise<object> {
        const uri = this.baseUri + 'updateHandles';
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Batch uploads objects, optionally deleting existing objects.
     *
     * @param objects Array of objects to upload
     * @param deleteCurrent Whether to delete current objects before uploading
     * @param options Options to use for this request
     */
    public async uploadObjects(objects: Array<CordraObject>, deleteCurrent: boolean = false, options: Options = this.defaultOptions): Promise<object> {
        let uri = this.baseUri + 'uploadObjects';
        if (deleteCurrent) uri += '?deleteCurrentObjects';
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'PUT',
                headers,
                body: JSON.stringify(objects)
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Lists the methods available for a given object.
     *
     * @param id The id of the object you want to list methods of. Either objectId or type is required.
     * @param options Options to use for this request
     */
    public async listMethods(id: string, options: Options = this.defaultOptions): Promise<Array<string>> {
        const uri = this.baseUri + 'listMethods?objectId=' + CordraClient.getEncodedWithSlashes(id);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Lists the methods available for a given type.
     *
     * @param type A Cordra type; depending on the static parameter, this will list static methods on that type, or instance methods on objects of the type.
     * @param listStatic If true, listing methods for a type will list static methods instead of instance methods.
     * @param options Options to use for this request
     */
    public async listMethodsForType(type: string, listStatic: boolean = false, options: Options = this.defaultOptions): Promise<Array<string>> {
        let uri = this.baseUri + 'listMethods?type=' + CordraClient.getEncodedWithSlashes(type);
        if (listStatic) uri += '&static';
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'GET',
                headers
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonPromise);
        });
    }

    /**
     * Calls a method on an object instance.
     *
     * @param objectId The id of the object on which to call an instance method. Either objectId or type is required.
     * @param method The name of the method to call.
     * @param jsonBody A json object representing the parameters to pass to the method.
     * @param options Options to use for this request
     */
    public async callMethod(objectId: string, method: string, jsonBody: object, options: Options = this.defaultOptions): Promise<any> {
        let uri = this.baseUri + 'call?objectId=' + CordraClient.getEncodedWithSlashes(objectId);
        uri += '&method=' + CordraClient.getEncodedWithSlashes(method);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'POST',
                headers,
                body: JSON.stringify(jsonBody)
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonOrUndefinedPromise);
        });
    }

    /**
     * Calls a method for a given type.
     *
     * @param method The name of the method to call.
     * @param jsonBody A json object representing the parameters to pass to the method.
     * @param type The id of the object on which to call an instance method. Either objectId or type is required.
     * @param options Options to use for this request
     */
    public async callMethodForType(type: string, method: string, jsonBody: object, options: Options = this.defaultOptions): Promise<any> {
        let uri = this.baseUri + 'call?type=' + CordraClient.getEncodedWithSlashes(type);
        uri += '&method=' + CordraClient.getEncodedWithSlashes(method);
        return await this.retryAfterTokenFailure(options, headers => {
            return fetch(uri, {
                method: 'POST',
                headers,
                body: JSON.stringify(jsonBody)
            })
            .then(CordraClient.checkForErrors)
            .then(CordraClient.returnJsonOrUndefinedPromise);
        });
    }

    // private async createOrUpdateFetch(cordraObject: CordraObject, isCreate: boolean, options: Options = this.defaultOptions): Promise<CordraObject> {
    //     let uri;
    //     if (isCreate) {
    //         uri = this.buildCreateUri(cordraObject, options);
    //     } else {
    //         uri = this.buildUpdateUri(cordraObject, options);
    //     }
    //     const formData = this.buildCreateOrUpdateData(cordraObject);
    //     return await this.retryAfterTokenFailure(options, headers => {
    //         return fetch(uri, {
    //             method: isCreate ? 'POST' : 'PUT',
    //             headers,
    //             body: formData
    //         })
    //         .then(this.checkForErrors)
    //         .then(this.returnJsonPromise);
    //     });
    // }

    private async createOrUpdate(cordraObject: CordraObject, isCreate: boolean, progressCallback?: ProgressCallback, options: Options = this.defaultOptions): Promise<CordraObject> {
        // This uses XMLHttpRequest instead of Fetch so that we can attach a progress callback.
        // Someday(tm), Fetch will support this: https://github.com/whatwg/fetch/issues/607
        let uri: string;
        if (isCreate) {
            uri = this.buildCreateUri(cordraObject, options);
        } else {
            uri = this.buildUpdateUri(cordraObject, options);
        }
        const body = this.buildCreateOrUpdateData(cordraObject);
        const method = isCreate ? 'POST' : 'PUT';
        return await this.retryAfterTokenFailure(options, headers => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open(method, uri);
                if (progressCallback) {
                    xhr.upload.onprogress = e => {
                        if (e.lengthComputable) {
                            progressCallback(e);
                        }
                    };
                }
                headers.forEach((value, name) => {
                    xhr.setRequestHeader(name, value);
                });
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.response));
                    } else {
                        const responseBody = xhr.response;
                        const init = {
                            status: xhr.status,
                            statusText: xhr.statusText,
                            headers: this.getHeadersFromXhr(xhr.getAllResponseHeaders())
                        };
                        const fetchResponse = new Response(responseBody, init);
                        reject(fetchResponse);
                    }
                };
                xhr.onerror = () => reject(xhr);
                xhr.send(body);
            });
        });
    }

    private buildCreateUri(cordraObject: CordraObject, options: Options): string {
        if (!cordraObject.type) {
            throw { message: 'Create error: "type" must be set in Cordra Object' };
        }
        let uri = this.baseUri + 'objects?full=true&type=' + CordraClient.getEncodedWithSlashes(cordraObject.type);
        if (cordraObject.id) uri += '&handle=' + CordraClient.getEncodedWithSlashes(cordraObject.id);
        if (options.suffix) uri += '&suffix=' + CordraClient.getEncodedWithSlashes(options.suffix);
        if (options.isDryRun) uri += '&dryRun';
        if (options.includeResponseContext) uri += '&includeResponseContext';
        return uri;
    }

    private buildUpdateUri(cordraObject: CordraObject, options: Options): string {
        if (!cordraObject.id) {
            throw { message: 'Update error: "id" must be set in Cordra Object' };
        }
        let uri = this.baseUri + 'objects/' + CordraClient.getEncodedWithSlashes(cordraObject.id);
        uri += '?full=true';
        uri += '&handle=' + CordraClient.getEncodedWithSlashes(cordraObject.id);
        if (cordraObject.type) uri += '&type=' + CordraClient.getEncodedWithSlashes(cordraObject.type);
        if (options.isDryRun) uri += '&dryRun';
        if (options.includeResponseContext) uri += '&includeResponseContext';
        return uri;
    }

    private buildCreateOrUpdateData(cordraObject: CordraObject): FormData {
        const formData = new FormData();
        formData.append('content', JSON.stringify(cordraObject.content));
        if (cordraObject.acl) {
            formData.append('acl', JSON.stringify(cordraObject.acl));
        }
        if (cordraObject.userMetadata) {
            formData.append('userMetadata', JSON.stringify(cordraObject.userMetadata));
        }
        if (cordraObject.payloadsToDelete && cordraObject.payloadsToDelete.length > 0) {
            cordraObject.payloadsToDelete.forEach(payloadToDelete => {
                formData.append('payloadToDelete', payloadToDelete);
            });
        }
        if (cordraObject.payloads && cordraObject.payloads.length > 0) {
            cordraObject.payloads.forEach(payload => {
                formData.append(payload.name, payload.body, payload.filename || '');
            });
        }
        return formData;
    }

    private encodeParams(params: QueryParams): string {
        let result = 'pageNum=' + params.pageNum + '&pageSize=' + params.pageSize;
        if (params.sortFields) {
            params.sortFields.forEach(field => {
                let fieldString = '&sortFields=' + CordraClient.getEncodedWithSlashes(field.name);
                if (field.reverse) fieldString += ' DESC';
                result += fieldString;
            });
        }
        return result;
    }

    private getHeadersFromXhr(xhrHeaders: string): Headers {
        const headers = new Headers();
        const parsedXhrHeaders = xhrHeaders.trim().split(/[\r\n]+/);
        parsedXhrHeaders.forEach(line => {
            const parts = line.split(': ');
            const name = parts.shift();
            const value = parts.join(': ');
            // @ts-ignore name guaranteed to be defined
            headers.append(name, value);
        });
        return headers;
    }
}
