const terser = require('rollup-plugin-terser');
const babel = require('@rollup/plugin-babel');
const nodeResolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const pkg = require('./package.json');
const rollup = require('rollup');

// This allows our ts files to use js in import statements (the better to build to browser ES2017)
// An alternative to consider: use extension-less import statements, and add the extension when building to browser ES2017
function jsToTsPathFilter(pkg, path, relativePath) {
    if (relativePath.startsWith("src/") && relativePath.endsWith(".js")) {
        return relativePath.substring(0, relativePath.length - 3) + ".ts";
    } else {
        return undefined;
    }
}

function versionedFilename() {
    return pkg.main.replace(/\.js$/, '-' + pkg.version + '.js');
}

function minFilename() {
    return pkg.main.replace(/\.js$/, '.min.js');
}

function versionedMinFilename() {
    return pkg.main.replace(/\.js$/, '-' + pkg.version + '.min.js');
}

const inputOptions = {
    input: "./src/index.ts",
    plugins: [
        babel.babel({
            exclude: ["dist/**", "node_modules/**"],
            extensions: [".ts", "tsx"],
            babelHelpers: 'bundled'
        }),
        nodeResolve({
            browser: true,
            customResolveOptions: {
                pathFilter: jsToTsPathFilter,
            },
            extensions: [ ".ts", ".mjs", ".js", ".json", ".node" ],
            jsnext: true,
            main: true,
        }),
        commonjs({
            include: "node_modules/**",
            // if false then skip sourceMap generation for CommonJS modules
            sourceMap: false,  // Default: true
        }),
    ],
};

const mainOptions = { file: pkg.main, format: 'umd', name: 'cnri', sourcemap: true };
const moduleOptions = { file: pkg.module, format: 'esm', sourcemap: true };
const versionedOptions = { file: versionedFilename(), format: 'umd', name: 'cnri', sourcemap: true };
const minOptions = { file: minFilename(), format: 'umd', name: 'cnri', sourcemap: true };
const versionedMinOptions = { file: versionedMinFilename(), format: 'umd', name: 'cnri', sourcemap: true };

async function build() {
    const bundle = await rollup.rollup(inputOptions);
    await bundle.write(mainOptions);
    await bundle.write(moduleOptions);
    await bundle.write(versionedOptions);
    inputOptions.plugins.push(terser.terser());
    const minBundle = await rollup.rollup(inputOptions);
    await minBundle.write(minOptions);
    await minBundle.write(versionedMinOptions);
}

build();
