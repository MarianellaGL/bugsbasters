import * as path from 'path';
import * as fs from 'fs';

let nativeModule: any = null;
let loadAttempted = false;

// The native module filename - kept as variable to avoid static analysis
const NATIVE_MODULE_NAME = 'bugsbasters-native';
const NATIVE_MODULE_EXT = '.node';

export function loadNativeModule(): any {
  if (loadAttempted) {
    return nativeModule;
  }

  loadAttempted = true;

  // Skip loading in environments where native modules don't work
  if (typeof process === 'undefined') {
    return null;
  }

  try {
    const nativeFileName = NATIVE_MODULE_NAME + NATIVE_MODULE_EXT;

    // Try to find the native module in various locations
    const possiblePaths = [
      path.join(__dirname, '..', 'native', nativeFileName),
      path.join(__dirname, '..', '..', 'native', nativeFileName),
    ];

    // Add cwd-based path if running in a project context
    if (process.cwd) {
      possiblePaths.push(
        path.join(process.cwd(), 'node_modules', 'bugsbasters', 'native', nativeFileName)
      );
    }

    for (const modulePath of possiblePaths) {
      try {
        if (fs.existsSync(modulePath)) {
          // Use Function constructor to create a dynamic require that bundlers won't analyze
          // This is intentional to allow runtime loading of native modules
          const dynamicRequire = new Function('modulePath', 'return require(modulePath)');
          nativeModule = dynamicRequire(modulePath);
          break;
        }
      } catch {
        // Continue to next path
      }
    }
  } catch {
    // Native module not available, will use pure JS implementation
    nativeModule = null;
  }

  return nativeModule;
}
