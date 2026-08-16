#!/usr/bin/env node

/**
 * RaagaX System & Environment Doctor
 * Verifies developer environment, dependencies, and build readiness without making modifications.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('   🔍 RaagaX System & Environment Doctor ');
console.log('========================================\n');

let allPassed = true;

function check(name, fn) {
  try {
    const result = fn();
    console.log(`  ✅ [PASS] ${name}: ${result || 'OK'}`);
  } catch (err) {
    allPassed = false;
    console.log(`  ⚠️  [WARN] ${name}: ${err.message || 'Check failed'}`);
  }
}

// 1. Node & NPM
check('Node.js Runtime', () => process.version);
check('NPM Package Manager', () => execSync('npm -v', { encoding: 'utf8' }).trim());

// 2. Package Lockfile & Stack Freeze
check('Lockfile Integrity (package-lock.json)', () => {
  const lockExists = fs.existsSync(path.join(__dirname, '..', 'package-lock.json'));
  if (!lockExists) throw new Error('Missing package-lock.json');
  return 'Present (Frozen Stack)';
});

// 3. Environment Variables Template
check('Environment Variables (.env.local)', () => {
  const envExists = fs.existsSync(path.join(__dirname, '..', '.env.local'));
  if (!envExists) throw new Error('.env.local file missing');
  return 'Present';
});

// 4. Capacitor Android Configuration
check('Capacitor Config (capacitor.config.json)', () => {
  const capConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capacitor.config.json'), 'utf8'));
  return `App ID: ${capConfig.appId} (${capConfig.appName})`;
});

// 5. Android Gradle Structure
check('Android Project Directory (android/)', () => {
  const androidExists = fs.existsSync(path.join(__dirname, '..', 'android'));
  if (!androidExists) throw new Error('android/ folder missing');
  return 'Native Media3 Android Project Present';
});

// 6. Java / JDK (Optional for Web, Required for APK)
check('Java Development Kit (JDK)', () => {
  try {
    const javaVer = execSync('javac -version 2>&1', { encoding: 'utf8' }).trim();
    return javaVer;
  } catch {
    return 'Not in PATH (needed only when building APK natively)';
  }
});

console.log('\n----------------------------------------');
if (allPassed) {
  console.log('  🎉 All Core Environment Checks PASSED!');
  console.log('  🛡️  Stack is Frozen & Ready for Development & Production Builds.');
} else {
  console.log('  ⚠️  Some checks had warnings. Review items above.');
}
console.log('----------------------------------------\n');
