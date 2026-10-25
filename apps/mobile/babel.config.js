const path = require("path");

// Ensure Node resolution finds packages in both mobile node_modules and monorepo root
const mobileModules = path.resolve(__dirname, "node_modules");
const rootModules = path.resolve(__dirname, "../../node_modules");

if (!process.env.NODE_PATH || !process.env.NODE_PATH.includes(mobileModules)) {
  process.env.NODE_PATH = [mobileModules, rootModules, process.env.NODE_PATH || ""]
    .filter(Boolean)
    .join(path.delimiter);
  try {
    require("module").Module._initPaths();
  } catch (_) {}
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          disableImportExportTransform: false,
        },
      ],
    ],
  };
};
