const includePolyfills = true;

module.exports = function (api) {
    api.cache.forever();
    return {
        "comments": false,
        "presets": [
            [
                "@babel/preset-env",
                {
                    "useBuiltIns": includePolyfills ? "usage" : false,
                    "corejs": 3
                }
            ],
            "@babel/preset-typescript"
        ],
        "plugins": [
            "@babel/plugin-proposal-class-properties",
            "@babel/plugin-proposal-object-rest-spread"
        ]
    };
};
