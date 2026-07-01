const path = require("node:path");
const { execFileSync } = require("node:child_process");

// Strip extended attributes from the packaged .app before electron-builder
// signs it. macOS adds xattrs like com.apple.FinderInfo, com.apple.provenance,
// and file-provider attributes (e.g. on synced/virtualized volumes) that make
// `codesign --options runtime` fail with:
//   "resource fork, Finder information, or similar detritus not allowed".
// No-op on non-macOS builds.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  execFileSync("xattr", ["-cr", appPath]);
};
