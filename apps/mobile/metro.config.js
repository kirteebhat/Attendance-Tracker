// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// Ensure NODE_PATH contains both mobile node_modules and monorepo root node_modules
// so all Metro worker processes can resolve modules from both locations
const mobileModules = path.resolve(projectRoot, "node_modules");
const rootModules = path.resolve(workspaceRoot, "node_modules");
const combinedPaths = [mobileModules, rootModules].join(path.delimiter);

if (!process.env.NODE_PATH || !process.env.NODE_PATH.includes(mobileModules)) {
  process.env.NODE_PATH = process.env.NODE_PATH
    ? `${combinedPaths}${path.delimiter}${process.env.NODE_PATH}`
    : combinedPaths;
  try {
    require("module").Module._initPaths();
  } catch (_) {}
}

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  mobileModules,
  rootModules,
];

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
