"use strict";

var assert = require("assert");
var practice = require("../js/app.js");

var words = [
  { id: "a", hanzi: "媽媽" },
  { id: "b", hanzi: "爸爸" },
  { id: "c", hanzi: "哥哥" }
];

var selected = practice.defaultSelection(words);
assert.deepStrictEqual(practice.selectedWords(words, selected).map(function (word) {
  return word.id;
}), ["a", "b", "c"]);
assert.strictEqual(practice.canStart(words, selected), true);

selected = practice.defaultSelection(words);
selected.b = false;
assert.deepStrictEqual(practice.selectedWords(words, selected).map(function (word) {
  return word.id;
}), ["a", "c"]);

selected.a = false;
selected.c = false;
assert.strictEqual(practice.canStart(words, selected), false);
assert.deepStrictEqual(practice.selectedWords(words, selected), []);
assert.strictEqual(practice.canStart([], {}), false);

var bare = [{ hanzi: "一" }, { hanzi: "二" }];
assert.strictEqual(practice.wordKey(bare[0], 0), "idx-0");
assert.strictEqual(practice.wordKey(bare[1], 1), "idx-1");
var bareSelected = practice.defaultSelection(bare);
bareSelected["idx-0"] = false;
assert.deepStrictEqual(practice.selectedWords(bare, bareSelected).map(function (word) {
  return word.hanzi;
}), ["二"]);

console.log("practice select tests passed");
