const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'node_modules', 'next', 'dist', 'build', 'index.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Check if patch is needed
  if (content.includes('const outputPath = _path.default.join(distDir, STANDALONE_DIRECTORY, _path.default.relative(outputFileTracingRoot, filePath));') &&
      !content.includes('if (_path.default.isAbsolute(relPath))')) {
    const unpatched = `const filePath = _path.default.join(requiredServerFiles.appDir, file);
            const outputPath = _path.default.join(distDir, STANDALONE_DIRECTORY, _path.default.relative(outputFileTracingRoot, filePath));
            await _fs.promises.mkdir(_path.default.dirname(outputPath), {
                recursive: true
            });
            await _fs.promises.copyFile(filePath, outputPath);`;

    const patched = `const filePath = _path.default.join(requiredServerFiles.appDir, file);
            let relPath = _path.default.relative(outputFileTracingRoot, filePath);
            if (_path.default.isAbsolute(relPath)) {
                relPath = relPath.replace(/^[a-zA-Z]:[/\\\\]+/, '');
            }
            const outputPath = _path.default.join(distDir, STANDALONE_DIRECTORY, relPath);
            await _fs.promises.mkdir(_path.default.dirname(outputPath), {
                recursive: true
            });
            try {
                if ((0, _fs.existsSync)(filePath)) {
                    await _fs.promises.copyFile(filePath, outputPath);
                }
            } catch (copyErr) {
                if (copyErr.code !== 'ENOENT') throw copyErr;
            }`;

    if (content.includes(unpatched)) {
      content = content.replace(unpatched, patched);
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log('[Patch] Next.js Windows standalone copyFile patch applied successfully.');
    }
  } else {
    console.log('[Patch] Next.js standalone is already patched or patch not required.');
  }

  // Patch 2: Guard hasCustomGetInitialProps and getDefinedNamedExports when pagesDir is undefined
  if (content.includes('const customAppGetInitialPropsPromise = pagesStaticWorkers.hasCustomGetInitialProps({')) {
    const unpatchedAppCheck = `const customAppGetInitialPropsPromise = pagesStaticWorkers.hasCustomGetInitialProps({
                    page: appPageToCheck,
                    distDir,
                    runtimeEnvConfig,
                    checkingApp: true
                });
                const namedExportsPromise = pagesStaticWorkers.getDefinedNamedExports({
                    page: appPageToCheck,
                    distDir,
                    runtimeEnvConfig
                });`;
    const patchedAppCheck = `const customAppGetInitialPropsPromise = pagesDir ? pagesStaticWorkers.hasCustomGetInitialProps({
                    page: appPageToCheck,
                    distDir,
                    runtimeEnvConfig,
                    checkingApp: true
                }) : Promise.resolve(false);
                const namedExportsPromise = pagesDir ? pagesStaticWorkers.getDefinedNamedExports({
                    page: appPageToCheck,
                    distDir,
                    runtimeEnvConfig
                }) : Promise.resolve([]);`;
    content = content.replace(unpatchedAppCheck, patchedAppCheck);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[Patch] Next.js App Router pagesDir guard patch applied successfully.');
  }
}
