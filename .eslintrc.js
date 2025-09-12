module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // Error Prevention
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off', // Allow console for server-side logging
    'no-debugger': 'error',
    'no-unreachable': 'error',
    'no-duplicate-imports': 'error',
    
    // Code Quality
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': 'error',
    'brace-style': ['error', '1tbs'],
    
    // Formatting
    'indent': ['error', 2],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    
    // Best Practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'strict': ['error', 'never'], // Node.js modules are strict by default
    
    // Node.js Specific
    'no-process-exit': 'error',
    'handle-callback-err': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',
    
    // Security
    'no-unsafe-negation': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-optional-chaining': 'error',
    
    // Performance
    'no-loop-func': 'error',
    'no-inner-declarations': 'error'
  },
  globals: {
    'process': 'readonly',
    'Buffer': 'readonly',
    '__dirname': 'readonly',
    '__filename': 'readonly',
    'global': 'readonly',
    'module': 'readonly',
    'require': 'readonly',
    'exports': 'readonly',
    'console': 'readonly'
  },
  overrides: [
    {
      // Test files
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-unused-expressions': 'off'
      }
    },
    {
      // Configuration files
      files: ['*.config.js', 'webpack.*.js', 'rollup.*.js'],
      env: {
        node: true
      },
      rules: {
        'no-console': 'off'
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.min.js',
    'public/js/libs/',
    '.claude-flow/',
    '.swarm/',
    'data/'
  ]
};