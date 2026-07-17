const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Ícones de banco: só `core.js` (o `index` da lib importa Vue e quebra no Metro).
 * NÃO usar `unstable_enablePackageExports` global — em produção web isso pode
 * resolver exports ESM errados e causar `TypeError: n is not a function` no ExpoRoot.
 */
const bancosBrasilCore = path.resolve(
  __dirname,
  'node_modules/@edusites/bancos-brasil/src/core.js',
);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@edusites/bancos-brasil' ||
    moduleName === '@edusites/bancos-brasil/src/core.js'
  ) {
    return { type: 'sourceFile', filePath: bancosBrasilCore };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
