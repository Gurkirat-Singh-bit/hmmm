/**
 * @file eslint.config.js
 * @description ESLint flat configuration for the Expo application.
 * @author Gurkirat Singh
 * @license MIT
 * @see https://docs.expo.dev/guides/using-eslint/
 */

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
]);
