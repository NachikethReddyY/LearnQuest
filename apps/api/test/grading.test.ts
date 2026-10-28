import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeMcq } from "../src/grading/mcq.ts";
import { gradeCloze } from "../src/grading/cloze.ts";

test("mcq grades by index", () => {
  assert.equal(gradeMcq(1, 1), true);
  assert.equal(gradeMcq(0, 1), false);
});

test("cloze ignores surrounding whitespace", () => {
  assert.equal(gradeCloze(" total ", "total", []), true);
});

test("cloze ignores comments", () => {
  assert.equal(gradeCloze("total /*x*/", "total", []), true);
  assert.equal(gradeCloze("total // note", "total", []), true);
});

test("cloze keeps quote style significant unless accepted", () => {
  assert.equal(gradeCloze("'a'", '"a"', []), false);
  assert.equal(gradeCloze("'a'", '"a"', ["'a'"]), true);
});

test("cloze ignores spacing inside the answer", () => {
  assert.equal(gradeCloze("discount=0", "discount = 0", []), true);
  assert.equal(gradeCloze("discount = 0", "discount = 0", []), true);
});

test("cloze rejects empty input", () => {
  assert.equal(gradeCloze("", "total", []), false);
  assert.equal(gradeCloze("   ", "total", []), false);
});

test("cloze rejects long garbage", () => {
  assert.equal(gradeCloze("x".repeat(200), "total", []), false);
});

test("cloze accepts an accepted variant", () => {
  assert.equal(gradeCloze("discount=0", "discount = 0", ["discount=0"]), true);
  assert.equal(gradeCloze("taxRate", "discount = 0", ["taxRate"]), true);
});
