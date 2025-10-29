module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    // Allow modern syntax used in functions code (optional chaining, empty catch)
    "ecmaVersion": 2020,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    // Don't enforce Unix line endings; developers on Windows may use CRLF
    "linebreak-style": "off",
    // Loosen style-only rules to reduce noise during deploys
    "max-len": ["error", { "code": 120, "ignoreStrings": true, "ignoreTemplateLiterals": true, "ignoreComments": true }],
    "object-curly-spacing": "off",
    "no-empty": ["error", { "allowEmptyCatch": true }],
    "require-jsdoc": "off",
    "indent": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
