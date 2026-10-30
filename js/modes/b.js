/* 模式 B 認讀選擇：看拼音或聽讀音後選字。骨架，不是自由打字。 */
var ModeB = (function () {
  "use strict";

  function fill(template, token, value) {
    return String(template || "").split(token).join(value || "");
  }

  function mount(root, ctx) {
    var copy = ctx.copy || {};
    var sample = ctx.sample;
    var prompt = sample
      ? fill(copy.prompt_pinyin, "{帶調拼音}", sample.pinyin)
      : "請先選擇有字詞的詞組。";
    root.replaceChildren();
    var badge = document.createElement("p");
    badge.className = "soon";
    badge.textContent = "即將推出";
    var title = document.createElement("h2");
    title.textContent = copy.name || "";
    var intro = document.createElement("p");
    intro.textContent = copy.intro || "";
    var line = document.createElement("p");
    line.className = "prompt";
    line.textContent = prompt;
    var audio = document.createElement("p");
    audio.className = "hint";
    audio.textContent = copy.prompt_audio || "";
    var done = document.createElement("p");
    done.className = "hint";
    done.textContent = copy.set_done || "";
    root.append(badge, title, intro, line, audio, done);
  }

  return { id: "B", mount: mount };
})();
