import init, { format as clangFormatWasm } from "https://esm.sh/@wasm-fmt/clang-format/web";

let initialized = false;
let initPromise = null;

const CLANG_FORMAT_CONFIG = `
Language: Cpp
TabWidth: 4
IndentWidth: 4
UseTab: ForContinuationAndIndentation
SpaceBeforeParens: ControlStatements
AllowShortFunctionsOnASingleLine: None
AlignEscapedNewlines: Left
AllowShortBlocksOnASingleLine: Never
AllowShortIfStatementsOnASingleLine: Never
AlwaysBreakAfterReturnType: None
AlwaysBreakBeforeMultilineStrings: false
BinPackArguments: false
BinPackParameters: false
BreakBeforeBraces: Allman
BreakBeforeTernaryOperators: true
ColumnLimit: 1024
IncludeBlocks: Merge
KeepEmptyLinesAtTheStartOfBlocks: false
MaxEmptyLinesToKeep: 1
PointerAlignment: Right
PenaltyBreakBeforeFirstCallParameter: 1
PenaltyBreakString: 1
PenaltyExcessCharacter: 10
PenaltyReturnTypeOnItsOwnLine: 100
SpaceAfterCStyleCast: false
SpaceBeforeAssignmentOperators: true
SpaceBeforeSquareBrackets: false
SpaceInEmptyParentheses: false
SpacesInCStyleCastParentheses: false
SpacesInParentheses: false
SpacesInSquareBrackets: false
AlignOperands: false
Cpp11BracedListStyle: true
`;

export async function ensureInit() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = init().then(() => {
    initialized = true;
  });
  return initPromise;
}

export function format(source, filename = "main.c") {
  if (!initialized) {
    throw new Error("Wasm clang-format not initialized yet. Call ensureInit() first.");
  }
  return clangFormatWasm(source, filename, CLANG_FORMAT_CONFIG);
}
