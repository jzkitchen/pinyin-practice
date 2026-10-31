/* 模式 A／C 的聲母、韻母、聲調點選。
 * 聲母、韻母和文案讀書本表（tables.shengmu／yunmu／ui_copy），不另抄一份。
 * 韻母按鈕的 value 是書本完整式（iou、uei、uen、ü）。只畫聲母、韻母、聲調，不放 er。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SyllablePicker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var COLUMN_ORDER = ["open", "i", "u", "ü"];

  function copyOf(tables) {
    return (tables && tables.ui_copy) || {};
  }

  function visibleShengmu(tables) {
    return ((tables && tables.shengmu) || []).filter(function (item) {
      var key = item && item.key != null ? String(item.key) : "";
      var label = item && item.label != null ? String(item.label) : "";
      if (!key) return false;
      if (key === "y" || key === "w") return false;
      if (label === "y" || label === "w" || label === "零") return false;
      return true;
    });
  }

  function shengmuGroups(tables) {
    var groups = [];
    var map = {};
    visibleShengmu(tables).forEach(function (item) {
      var id = String(item.group);
      if (!map[id]) {
        map[id] = [];
        groups.push({ id: id, items: map[id] });
      }
      map[id].push(item);
    });
    return groups;
  }

  function yunmuColumns(tables) {
    var titles = copyOf(tables).column_titles || {};
    return COLUMN_ORDER.map(function (id) {
      return {
        id: id,
        title: titles[id] || id,
        items: ((tables && tables.yunmu) || []).filter(function (item) { return item.column === id; })
      };
    });
  }

  function model(tables) {
    var copy = copyOf(tables);
    return {
      shengmuTitle: copy.shengmu_title || "聲母",
      emptyHint: copy.empty_shengmu_hint || "",
      shengmuGroups: shengmuGroups(tables),
      yunmuTitle: copy.yunmu_title || "韻母",
      yunmuNote: copy.yunmu_note || "",
      abbrevHint: copy.abbrev_hint || "",
      columns: yunmuColumns(tables),
      shengdiaoTitle: copy.shengdiao_title || "聲調",
      shengdiao: (tables && tables.shengdiao) || []
    };
  }

  function button(label, part, value, pressed) {
    var node = document.createElement("button");
    node.type = "button";
    node.className = "pick";
    node.setAttribute("data-part", part);
    node.setAttribute("data-value", value);
    node.setAttribute("aria-pressed", pressed ? "true" : "false");
    node.textContent = label;
    return node;
  }

  function heading(tag, text) {
    var node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function note(text) {
    if (!text) return null;
    var node = document.createElement("p");
    node.className = "hint";
    node.textContent = text;
    return node;
  }

  function append(parent, opts) {
    var tables = opts.tables || {};
    var slot = opts.slot || {};
    var onChoose = typeof opts.onChoose === "function" ? opts.onChoose : function () {};
    var view = model(tables);
    parent.appendChild(shengmuBlock(view, slot, onChoose));
    parent.appendChild(yunmuBlock(view, slot, onChoose));
    parent.appendChild(toneBlock(view, slot, onChoose));
  }

  function shengmuBlock(view, slot, onChoose) {
    var block = document.createElement("div");
    block.className = "picker-block";
    var groups = document.createElement("div");
    groups.className = "shengmu-groups";
    var current = slot.initial != null && slot.initial !== "" ? String(slot.initial) : "";
    view.shengmuGroups.forEach(function (group) {
      var row = document.createElement("div");
      row.className = "chips";
      row.setAttribute("data-shengmu-group", group.id);
      group.items.forEach(function (item) {
        var pressed = current === String(item.key);
        var node = button(item.label, "initial", item.key, pressed);
        if (pressed) node.title = "再按一次，改為不選聲母";
        node.addEventListener("click", function () {
          onChoose("initial", pressed ? null : item.key);
        });
        row.appendChild(node);
      });
      groups.appendChild(row);
    });
    var hint = note(view.emptyHint);
    block.appendChild(heading("h3", view.shengmuTitle));
    if (hint) block.appendChild(hint);
    block.appendChild(groups);
    return block;
  }

  function yunmuBlock(view, slot, onChoose) {
    var block = document.createElement("div");
    block.className = "picker-block";
    var grid = document.createElement("div");
    grid.className = "yunmu-grid";
    var current = slot.final != null ? String(slot.final) : "";
    view.columns.forEach(function (column) {
      var col = document.createElement("div");
      col.className = "yunmu-col";
      col.setAttribute("data-column", column.id);
      col.setAttribute("role", "group");
      col.setAttribute("aria-label", column.title);
      var row = document.createElement("div");
      row.className = "chips";
      column.items.forEach(function (item) {
        var pressed = current === String(item.key);
        var node = button(item.label, "final", item.key, pressed);
        node.addEventListener("click", function () { onChoose("final", item.key); });
        row.appendChild(node);
      });
      col.appendChild(heading("h4", column.title));
      col.appendChild(row);
      grid.appendChild(col);
    });
    var bookNote = note(view.yunmuNote);
    var abbrev = note(view.abbrevHint);
    block.appendChild(heading("h3", view.yunmuTitle));
    if (bookNote) block.appendChild(bookNote);
    if (abbrev) block.appendChild(abbrev);
    block.appendChild(grid);
    return block;
  }

  function toneBlock(view, slot, onChoose) {
    var block = document.createElement("div");
    block.className = "picker-block";
    var row = document.createElement("div");
    row.className = "chips";
    var current = slot.tone == null ? null : String(slot.tone);
    view.shengdiao.forEach(function (item) {
      var value = String(item.tone);
      var pressed = current != null && current === value;
      var node = button(item.label + " " + item.mark, "tone", value, pressed);
      node.addEventListener("click", function () { onChoose("tone", value); });
      row.appendChild(node);
    });
    block.appendChild(heading("h3", view.shengdiaoTitle));
    block.appendChild(row);
    return block;
  }

  return {
    model: model,
    append: append,
    columnOrder: COLUMN_ORDER.slice()
  };
});
