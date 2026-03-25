// scripts/compile-ink.cjs
const fs = require("fs");
const path = require("path");

const inkjs = require("inkjs/full");
const { PosixFileHandler } = require("inkjs/compiler/FileHandler/PosixFileHandler");

const input = path.resolve(__dirname, "story.ink");
const output = path.resolve(__dirname, "public", "story.json");

const baseDirPosix = path.dirname(input).replaceAll(path.sep, path.posix.sep) + "/";

const ink = fs.readFileSync(input, "utf8").replace(/^\uFEFF/, "");

const fileHandler = new PosixFileHandler(baseDirPosix);

const errors = [];
const errorHandler = (message, errorType) => {
  // inkjs 会把行号/原因放在 message 里
  errors.push(String(message));
};

try {
  const story = new inkjs.Compiler(ink, { fileHandler, errorHandler, sourceFilename: "story.ink" }).Compile();

  if (errors.length) {
    console.log("\n[Ink warnings/errors]\n" + errors.join("\n") + "\n");
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, story.ToJson(), "utf8");
  console.log(`Compiled ${input} -> ${output}`);
} catch (e) {
  console.log("\n[Ink compile failed]\n");
  if (errors.length) {
    console.log(errors.join("\n") + "\n");
  } else {
    console.log("No detailed compiler messages captured.\n");
  }
  throw e; // 继续抛出，保证 npm 能看到失败
}