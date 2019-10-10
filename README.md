# Cordra Client Library - JavaScript Version

This Cordra Client Library can be used to develop JavaScript and TypeScript
applications that are based on [Cordra](https://www.cordra.org/).  This library depends
on browser support for fetch, and so includes a fetch polyfill.

This library is for browsers only. Its use in NodeJS is not currently supported. All
modern browsers are supported including IE11 (that leverages the included fetch polyfill).

The client library is written in TypeScript; type definitions are included in the
release distribution for use in your applications.


## Installation

You can install the client library using npm as follows:

```
npm install @cnri/cordra-client
```

The following artifacts are included in the distribution:

**dist/cordra-client.js, dist/cordra-client.min.js**
: Libraries suitable for including in `<script>` HTML tags, both un-minimized and minimized.
  These can also be used as a CommonJS module.
  Copies are supplied with the version number in the filename.

**dist/cordra-client.esm.js**
: As a standard ES module, suitable for use in applications built using an
  ESM-aware module bundler like Rollup or webpack 2+.

**dist/types/**
: A directory of `.d.ts` files for use with TypeScript projects.

The `.js` files all come with corresponding `.js.map` JavaScript source map files.


## Getting Started

This Cordra client library is simple to get started with. Here is an example of searching Cordra
for all Schema objects:

```javascript
const client = new CordraClient("https://localhost:8443");
client.search("type:Schema")
    .then(response => {
        console.log("Number of results: " + response.size);
        response.results.forEach(result => { console.log(result.content.name) });
    });
```

This will print the name of each Schema object to the console.

## Authentication

Cordra client methods generally take a final optional Options argument which defines the user credentials used
for sending the request to Cordra.  The default options can be set when the CordraClient is instantiated,
or later by setting the property `defaultOptions`.

If no defaultOptions is set, calls will be made anonymously.

Cordra client tracks authentication tokens automatically.  If you wish to check whether an authentication token
can be successfully obtained, call `client.authenticate(options)`.  Otherwise authentication tokens will be
automatically obtained as needed.

**Example Password Authentication**

```javascript
const options = {
    username: "testUser",
    password: "password"
};
const client = new CordraClient(cordraBaseUri, options);
```

**Example Private Key Authentication**

```javascript
const privateKey = {
    "kty": "RSA",
    "n": "4zExVGqSPDNAIooQyNDm_g8ew9RwdDcRCGuWBjIZrfIHVGlJn1VbT4reseduDJ0MVELdDp64RTH8jVxboWQlpQ",
    "e": "AQAB",
    "d": "CPmfhkMzhbdMmFC1-wjtpym3wGq7CoxGWvvNEGOV2h47gJaMBAsh4XYszToaNOKOg-OpCQ73dn8FsvIKmh5VQQ",
    "p": "_sgNIghoOHpnYjmcsQ09VXLg73oGOqtVd48C8ZJmfFE",
    "q": "5Edcl0pHnl-p79KtefVPwVFMFUJT0QKG-BfJfWxXAxU",
    "dp": "VAbKPgUjyiykWALEKKhDKCFBCfnmgEbtowapY95yqmE",
    "dq": "OTDTtqeKZ9gpuAa9JXfbAmC-wfi7DPsoG1HCTiTta70",
    "qi": "n2lKEca8FCHWS5Q81N0ioJ60Ny8a1dce7Yl9JzayjTM"
};
const options = {
    userId: 'testUser',
    privateKey
};
const client = new CordraClient(cordraBaseUri, options);
```

## API Docs

Full API documentation that corresponds to this version of the client library release can
be produced by running `npm run build:docs`, and will be built into the `dist/docs` folder.

## Development Setup

If you prefer to update the source code, you can use the following commands to build the source code:

```
npm install
```

To build the client library, run:

```
npm run clean
```

and then:

```
npm run build
```

This will generate two compiled bundles in the `dist` folder:

* a UMD-style bundle named `cordra-client.js`
* an ES6-style bundle named `cordra-client.esm.js`

Type declarations will also be built into `dist/types`.

If you prefer, you can also generate unbundled ES2017 javascript
using this command:

```
npm run build:es2017
```

This code will be generated under `dist/es2017`.

#### Running the Tests

Running the tests requires that you have a local Cordra server running
with the default settings and schemas. You should set the password to 'password',
or change the password in `test/cordra.test.js`.

To run the tests on the compiled bundle, run

```
npm run test
```

or equivalently

```
npm test
```

To run the tests on the unbundled ES2017 module, run

```
npm run test:es2017
```

## Versioning

Cordra client versions will have an `X.Y.Z` format. The first two digits will match the first
two digits of the version of Cordra server software the client works with. The last digit will
increment independently from Cordra server versions. So, for example, Cordra client versions
`2.0.2` or `2.0.3` will work with Cordra server version `2.0.0`.

## License

See the [LICENSE.txt](LICENSE.TXT) file for details.
