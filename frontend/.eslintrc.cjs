module.exports = {
    root: true,
    env: {
      browser: true,
      es2021: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: ['react', '@typescript-eslint'],
    extends: [
      'eslint:recommended',
      'plugin:react/recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
      'prettier',
    ],
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Empêche les erreurs sur l'import JSX avec React 17+
      'react/react-in-jsx-scope': 'off',
  
      // Avertit au lieu de bloquer pour les variables inutilisées
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  
      // Désactive la règle qui bugue avec allowShortCircuit
      '@typescript-eslint/no-unused-expressions': 'off',
  
      // Autorise les JSX fragments <></>
      'react/jsx-fragments': ['warn', 'syntax'],
    },
  };
  