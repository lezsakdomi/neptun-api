module.exports = {
  "presets": [
    [
      "@babel/preset-typescript",
      {
        "isTSX": true,
        "allExtensions": true
      }
    ],
    [
      "@babel/preset-react",
      {
        "pragma": "JSX.createElement"
      }
    ]
  ],
  "plugins": (process.env.DIST_TYPE === 'es6' ? [] : [
    "@babel/plugin-transform-modules-commonjs",
    "@babel/plugin-transform-async-to-generator",
    "@babel/plugin-proposal-export-namespace-from",
  ]).concat([
    "babel-plugin-add-import-extension",
  ]),
  "sourceMaps": "inline"
}
