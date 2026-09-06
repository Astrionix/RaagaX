/**
 * RaagaX Cross-Platform Android APK Build Script
 * Supports macOS, Linux, and Windows seamlessly.
 * Auto-detects Java Runtime (JDK) location if JAVA_HOME is missing.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');
const isWin = process.platform === 'win32';

console.log('🚀 [RaagaX Build] Starting cross-platform Android APK compilation...');
console.log(`ℹ️ [RaagaX Build] Operating System: ${process.platform}`);

function autoDetectJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  const candidatePaths = isWin
    ? [
        'C:\\Program Files\\Android\\Android Studio\\jbr',
        'C:\\Program Files\\Java\\jdk-17',
        'C:\\Program Files\\Java\\jdk-21',
      ]
    : [
        path.join(process.env.HOME || '/Users/chandureddy', '.jdk17', 'Contents', 'Home'),
        path.join(process.env.HOME || '/Users/chandureddy', '.jdk17'),
        '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
        '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
        '/opt/homebrew/opt/openjdk@17',
        '/opt/homebrew/opt/openjdk',
        '/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
        '/usr/local/opt/openjdk@17',
        '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
        '/Applications/Android Studio.app/Contents/jre/Contents/Home',
      ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      console.log(`🔍 [RaagaX Build] Auto-detected Java JDK at: ${p}`);
      return p;
    }
  }

  if (!isWin) {
    try {
      const detected = execSync('/usr/libexec/java_home 2>/dev/null').toString().trim();
      if (detected && fs.existsSync(detected)) {
        return detected;
      }
    } catch {}
  }

  return null;
}

const detectedJava = autoDetectJavaHome();
if (detectedJava) {
  process.env.JAVA_HOME = detectedJava;
  const binPath = path.join(detectedJava, 'bin');
  if (fs.existsSync(binPath)) {
    process.env.PATH = `${binPath}${path.delimiter}${process.env.PATH}`;
  }
  console.log(`☕ [RaagaX Build] JAVA_HOME set to: ${detectedJava}`);
} else {
  console.warn('⚠️ [RaagaX Build] JAVA_HOME not found in environment or standard paths.');
}

try {
  // Step 1: Clean stale APKs
  console.log('\n🧹 Step 1: Cleaning previous APK outputs...');
  execSync('node scripts/clean-apks.js', { cwd: rootDir, stdio: 'inherit' });

  // Step 2: Export static app shell
  console.log('\n📦 Step 2: Building Next.js static app-shell (export:app)...');
  execSync('npm run export:app', { cwd: rootDir, stdio: 'inherit' });

  // Step 3: Sync Capacitor assets with Android project
  console.log('\n⚡ Step 3: Syncing Capacitor Android assets (apk:sync)...');
  execSync('npm run apk:sync', { cwd: rootDir, stdio: 'inherit' });

  // Step 4: Run Gradle build cross-platform
  console.log('\n🔨 Step 4: Compiling Android APK with Gradle...');

  if (!isWin) {
    const gradlewPath = path.join(androidDir, 'gradlew');
    if (fs.existsSync(gradlewPath)) {
      try {
        fs.chmodSync(gradlewPath, '755');
      } catch (e) {
        console.warn('⚠️ Could not set executable permissions on gradlew:', e.message);
      }
    }
    execSync('./gradlew assembleDebug', {
      cwd: androidDir,
      stdio: 'inherit',
      env: { ...process.env },
    });
  } else {
    // Windows execution
    if (fs.existsSync(path.join(androidDir, 'build-apk.bat'))) {
      execSync('build-apk.bat', { cwd: androidDir, stdio: 'inherit', env: { ...process.env } });
    } else {
      execSync('gradlew.bat assembleDebug', { cwd: androidDir, stdio: 'inherit', env: { ...process.env } });
    }
  }

  // Step 5: Copy generated APK to root and Desktop
  const apkOutput = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const targetApk = path.join(rootDir, 'RaagaX.apk');
  const desktopDir = path.join(process.env.HOME || '/Users/chandureddy', 'Desktop');
  const desktopApk = path.join(desktopDir, 'RaagaX.apk');

  if (fs.existsSync(apkOutput)) {
    fs.copyFileSync(apkOutput, targetApk);
    try {
      if (fs.existsSync(desktopDir)) {
        fs.copyFileSync(apkOutput, desktopApk);
        console.log(`🖥️ [SUCCESS] RaagaX APK copied to Desktop: ${desktopApk}`);
      }
    } catch (e) {
      console.warn('Could not copy APK to Desktop:', e.message);
    }
    console.log(`\n🎉 [SUCCESS] RaagaX APK compiled successfully!`);
    console.log(`📍 Project output location: ${targetApk}`);
  } else {
    console.log(`\n✅ Gradle compilation completed.`);
  }

} catch (err) {
  console.error('\n❌ [BUILD ERROR] Failed to compile RaagaX APK:', err.message);
  process.exit(1);
}
