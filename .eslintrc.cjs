module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  globals: {
    uni: 'readonly',
    wx: 'readonly',
    plus: 'readonly',
    getApp: 'readonly',
    getCurrentPages: 'readonly'
  },
  ignorePatterns: [
    'node_modules/',
    'uni_modules/',
    'unpackage/',
    '.idea/',
    '.vscode/'
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off'
  }
}
