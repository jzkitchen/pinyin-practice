/* 模式 C 組合拼音：骨架。玩法尚未實作。 */
var ModeC = (function () {
  "use strict";

  function fill(template, token, value) {
    return String(template || "").split(token).join(value || "");
  }

  function mount(root, ctx) {
    var copy = ctx.copy || {};
    var sample = ctx.sample;
    var prompt = sample ? fill(copy.prompt, "{詞}", sample.hanzi) : "請先選擇有字詞的詞組。";
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
    var done = document.createElement("p");
    done.className = "hint";
    done.textContent = copy.set_done || "";
    root.append(badge, title, intro, line, done);
  }

  return { id: "C", mount: mount };
})();
