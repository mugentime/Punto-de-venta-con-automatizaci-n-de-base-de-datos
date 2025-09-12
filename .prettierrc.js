module.exports = {
  // Core formatting
  semi: true,
  trailingComma: 'none',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  
  // JavaScript
  arrowParens: 'avoid',
  bracketSpacing: true,
  bracketSameLine: false,
  
  // HTML/Templates
  htmlWhitespaceSensitivity: 'css',
  
  // Other
  endOfLine: 'lf',
  quoteProps: 'as-needed',
  
  // File overrides
  overrides: [
    {
      files: '*.json',
      options: {
        singleQuote: false
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'always'
      }
    }
  ]
};