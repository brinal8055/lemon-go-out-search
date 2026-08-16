/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('yaml');
config.watchFolders.push(path.resolve(__dirname, '../..'));

module.exports = config;
