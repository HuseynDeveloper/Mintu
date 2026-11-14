const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sdkDest = 'C:\\Users\\TT_S\\AppData\\Local\\Temp\\msix_sdk';
const makeappx = path.join(sdkDest, 'makeappx.exe');
const sourceMsix = 'C:\\Users\\TT_S\\OneDrive\\Desktop\\722PixelGroup.Mintu-DesktopCompanion_0.2.2.0_x64__844g808zq86em.msix';
const targetMsix = 'C:\\Users\\TT_S\\OneDrive\\Desktop\\722PixelGroup.Mintu-DesktopCompanion_0.2.3.0_x64__844g808zq86em.msix';
const tempDir = 'C:\\Users\\TT_S\\AppData\\Local\\Temp\\msix_build_023';

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('Unpacking template MSIX...');
execSync(`"${makeappx}" unpack /p "${sourceMsix}" /d "${tempDir}" /o`, { stdio: 'inherit' });

console.log('Updating AppxManifest.xml to 0.2.3.0...');
const manifestPath = path.join(tempDir, 'AppxManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
manifest = manifest.replace(/Version="[0-9.]+"/, 'Version="0.2.3.0"');
fs.writeFileSync(manifestPath, manifest, 'utf8');

console.log('Copying newly built mintu.exe...');
const targetExe = path.join(tempDir, 'VFS', 'Profile', 'mintu-space', 'Mintu', 'mintu.exe');
const sourceExe = 'D:\\mintu-target\\release\\mintu.exe';
fs.copyFileSync(sourceExe, targetExe);

const blockMap = path.join(tempDir, 'AppxBlockMap.xml');
if (fs.existsSync(blockMap)) fs.unlinkSync(blockMap);
const sig = path.join(tempDir, 'AppxSignature.p7x');
if (fs.existsSync(sig)) fs.unlinkSync(sig);

console.log('Packing 0.2.3.0 MSIX...');
execSync(`"${makeappx}" pack /d "${tempDir}" /p "${targetMsix}" /o`, { stdio: 'inherit' });

console.log('Cleaning temp directory...');
fs.rmSync(tempDir, { recursive: true, force: true });

console.log('Done! Generated: ' + targetMsix);
