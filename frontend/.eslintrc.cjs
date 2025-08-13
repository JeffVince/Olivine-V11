module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  plugins: ['@typescript-eslint', 'vue'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'vue/multi-word-component-names': ['error', {
      ignores: ['Dashboard', 'Home', 'Projects', 'Settings', 'Notifications', 'Integrations', 'ApprovalsReviews', 'AgentConsole', 'FileExplorer', 'MappingStudio']
    }],
    'vue/valid-v-slot': ['error', {
      allowModifiers: true
    }],
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};


