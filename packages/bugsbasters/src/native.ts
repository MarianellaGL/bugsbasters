import * as path from 'path';
import * as fs from 'fs';

let nativeModule: any = null;
let loadAttempted = false;

function getPlatformTriple(): string {
  const platform = process.platform;
  const arch = process.arch;

  // Map Node.js platform/arch to Rust target triples
  if (platform === 'win32') {
    if (arch === 'x64') return 'win32-x64-msvc';
    if (arch === 'arm64') return 'win32-arm64-msvc';
    if (arch === 'ia32') return 'win32-ia32-msvc';
  } else if (platform === 'darwin') {
    if (arch === 'x64') return 'darwin-x64';
    if (arch === 'arm64') return 'darwin-arm64';
  } else if (platform === 'linux') {
    if (arch === 'x64') return 'linux-x64-gnu';
    if (arch === 'arm64') return 'linux-arm64-gnu';
  }

  return `${platform}-${arch}`;
}

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
    const triple = getPlatformTriple();
    const nativeFileName = `bugsbasters-native.${triple}.node`;

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
