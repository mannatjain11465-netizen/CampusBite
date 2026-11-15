const esbuild = require('esbuild');

module.exports = {
  process(sourceText, sourcePath) {
    const result = esbuild.transformSync(sourceText, {
      loader: 'ts',
      format: 'esm',
      target: 'node22',
      sourcemap: 'inline',
      sourcefile: sourcePath,
    });
    return {
      code: result.code,
      map: result.map,
    };
  },
};
