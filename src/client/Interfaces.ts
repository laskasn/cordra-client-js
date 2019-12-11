
/**
 * Access Control on an Object.
 *
 * Both readers and writers are optional, and Cordra defaults will be applied if both the properties are not provided.
 */
export interface AccessControlList {
    /** Readers property expects an array list of user ids who can read this object.*/
    readers?: Array<string>;
    /** Writers property expects an array list of user ids who can write to * this object.*/
    writers?: Array<string>;
}

export interface AuthResponse {
    /** Authentication token */
    access_token?: string;
    /** Access token type */
    token_type?: string;
    /** Whether there is an active authentication token */
    active: boolean;
    /** Cordra ID of the authenticated user */
    userId?: string;
    /** Cordra username of the authenticated user */
    username?: string;
    /** Types this user can create */
    typesPermittedToCreate?: Array<string>;
    /** Cordra IDs for groups this user is a member of */
    groupIds?: Array<string>;
}

export interface AuthTokenInfo {
    token: string;
    lastUsed: number;
}

export interface AuthTokens {
    [_: string]: AuthTokenInfo;
}

export interface CordraObject {
    /** ID of the object. Required when updating an object */
    id?: string;
    /** Object type. Required when creating a new object */
    type?: string;
    /** JSON representation of the object */
    content?: any;
    acl?: AccessControlList;
    /** User-defined metadata that is stored with the object */
    userMetadata?: object;
    /** System-generated metadata */
    metadata?: Metadata;
    payloads?: Array<Payload>;
    /** List of payloads to delete. Used when updating an object */
    payloadsToDelete?: Array<string>;
    /** Extra response information that is not stored with the object */
    responseContext?: object;
}

export interface Metadata {
    createdOn: number;
    createdBy: string;
    modifiedOn: number;
    modifiedBy: string;
    txnId: number;
    /** Indicates whether this object is a version of another object */
    isVersion?: boolean;
    /** Cordra ID of the object this object is a version of */
    versionOf?: string;
    /** Timestamp indicating when version was published */
    publishedOn?: number;
    /** Cordra ID of the user who published this version */
    publishedBy?: string;
}

/**
 * Options for a given request.
 *
 * The client constructor and most operations take an Options object as the final
 * parameter. If this object is passed into the constructor, it is set as the default
 * and used whenever no Options object is give. If no options are given when creating
 * a client, an empty object is used by default.
 */
export interface Options {
    /** Cordra ID of the user */
    userId?: string;
    /** Username of the user */
    username?: string;
    /** User password */
    password?: string;
    /** User private key */
    privateKey?: JsonWebKey;
    /** Bearer token to use for authentication */
    token?: string | null;

    /** Cordra ID of user to perform operation as */
    asUserId?: string;
    /** Suffix to add to generated ID on object creation */
    suffix?: string;
    /** Whether to do a dry run of the operation */
    isDryRun?: boolean;
    /** Whether to request the inclusion of a responseContext */
    includeResponseContext?: boolean;
    /** set as true if you want to perform authentication from external providers **/
    keycloakConfig?: KeycloakConfig;
}


export interface KeycloakConfig {
  url?: string;
  realm?: string;
  clientId?: string;
}


export interface Payload {
    name: string;
    body: Blob;
    filename?: string;
    mediaType?: string;
    size?: number;
}

export interface QueryParams {
    /** Indicates which page of results this query should request */
    pageNum?: number;
    /** The number of items per results batch */
    pageSize?: number;
    /** Fields used to sort the query results */
    sortFields?: Array<SortField>;
}

export interface SearchResults {
    /** Indicates which page of results included in this response */
    pageNum: number;
    /** The number of items per results batch */
    pageSize: number;
    /** Total number of results matching the query */
    size: number;
    /** The Cordra Objects or IDs for this response */
    results: Array<CordraObject> | Array<string>;
}

export interface SortField {
    /** Name of the field to sort by. Fields contained in the object content should start with a / */
    name: string;
    /** Whether or not to reverse sort on this field */
    reverse?: boolean;
}

export interface VersionInfo {
    id: string;
    type: string;
    versionOf?: string;
    publishedBy?: string;
    publishedOn?: number;
    modifiedOn?: number;
    isTip?: boolean;
}

export interface ErrorResponse {
    status?: number;
    statusText?: string;
    message?: string;
    body?: object;
}

export interface TokenRequest {
    grant_type?: string;
    assertion?: string;
    username?: string;
    password?: string;
    token?: string | null;
}
