/**
 * @type {import('prettier').Options}
 */
export default {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: false,
  trailingComma: "none",
  bracketSpacing: true,
  bracketSameLine: true,
  endOfLine: "lf",
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrder: [
    "<BUILTIN_MODULES>",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@plasmo/(.*)$",
    "",
    "^@plasmohq/(.*)$",
    "",
    "^[@~]/(.*)$",
    "",
    "^[./]"
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  importOrderTypeScriptVersion: "5.3.3"
}
