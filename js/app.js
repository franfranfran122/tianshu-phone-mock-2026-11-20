(function () {
  "use strict";

  var KEY = "tianshu-reading-2026";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function readState() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function writeState(data) {
    var cur = readState();
    Object.keys(data).forEach(function (k) { cur[k] = data[k]; });
    sessionStorage.setItem(KEY, JSON.stringify(cur));
    return cur;
  }

  function dash(v) {
    v = (v == null ? "" : String(v)).trim();
    return v ? v : "—";
  }

  /* Keep the last two characters + period of a sentence on the same line. Skip locked cover copy. */
  function protectOrphans(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var parent = node.parentNode;
      if (!parent) return;
      if (parent.closest && (parent.closest(".cover-copy") || parent.closest(".lede") || parent.closest(".nw"))) return;
      var t = node.nodeValue;
      if (!t || !/[。．！？]/.test(t)) return;
      var html = t.replace(/([\u4e00-\u9fff]{2})([。．！？])/g, '<span class="nw">$1$2</span>');
      if (html === t) return;
      var wrap = document.createElement("span");
      wrap.innerHTML = html;
      parent.replaceChild(wrap, node);
    });
  }

  /* Cover video fallback: if autoplay fails, Ken Burns still */
  var hero = $(".hero");
  var vid = hero && $(".hero-vid", hero);
  if (vid) {
    var markStill = function () { hero.classList.add("is-still"); };
    var markPlay = function () { hero.classList.remove("is-still"); };
    var p = vid.play();
    if (p && p.then) {
      p.then(markPlay).catch(markStill);
    }
    vid.addEventListener("playing", markPlay);
    vid.addEventListener("error", markStill);
    setTimeout(function () {
      if (vid.paused || vid.readyState < 2) markStill();
    }, 1200);
  }

  /* Waitlist */
  var wait = $("[data-waitlist]");
  if (wait) {
    wait.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = ($("#email", wait) || {}).value || "";
      writeState({ waitlist: email, waitedAt: Date.now() });
      wait.hidden = true;
      var ok = $("[data-wait-ok]");
      if (ok) ok.hidden = false;
    });
    if (readState().waitlist) {
      wait.hidden = true;
      var ok2 = $("[data-wait-ok]");
      if (ok2) ok2.hidden = false;
    }
  }

  /* Start form pickers */
  function bindToggle(sel, attr, hiddenName) {
    var root = $(sel);
    if (!root) return;
    $all("button", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all("button", root).forEach(function (b) { b.classList.remove("on"); });
        btn.classList.add("on");
        var hidden = root.parentNode.querySelector('input[name="' + hiddenName + '"]');
        if (hidden) hidden.value = btn.getAttribute(attr) || "";
      });
    });
  }
  bindToggle("[data-cal-pick]", "data-cal", "cal");
  bindToggle("[data-gender-pick]", "data-gender", "gender");

  var usePick = $("[data-use-pick]");
  if (usePick) {
    $all(".use", usePick).forEach(function (lab) {
      lab.addEventListener("click", function () {
        $all(".use", usePick).forEach(function (x) { x.classList.remove("on"); });
        lab.classList.add("on");
      });
    });
  }

  var form = $("#start-form");
  if (form) {
    form.addEventListener("submit", function () {
      var fd = new FormData(form);
      writeState({
        use: fd.get("use") || "year",
        y: (fd.get("y") || "").trim(),
        m: (fd.get("m") || "").trim(),
        d: (fd.get("d") || "").trim(),
        cal: fd.get("cal") || "solar",
        place: (fd.get("place") || "").trim(),
        gender: fd.get("gender") || "",
        time: (fd.get("time") || "").trim()
      });
    });
  }

  /* Generate sequence */
  var gen = $("[data-generate]");
  if (gen) {
    var st = readState();
    var params = new URLSearchParams(location.search);
    if (params.get("use")) st = writeState({ use: params.get("use") });
    ["y","m","d","cal","place","gender","time"].forEach(function (k) {
      if (params.has(k)) st[k] = params.get(k);
    });
    writeState(st);

    var skip = $("[data-skip-gen]");
    var dest = "year.html";
    if (skip) skip.setAttribute("href", dest);

    var titles = {
      year: "先立定底層，<br>再打開 <span class=\"nw\">2027 流年。</span>",
      natal: "先立定底層，<br>排出<span class=\"nw\">本命盤。</span>",
      combined: "先立定底層，<br>再把流年一<span class=\"nw\">併讀。</span>"
    };
    var t = $("[data-gen-title]");
    if (t) t.innerHTML = titles[st.use] || titles.year;

    if (params.get("stay") !== "1") {
      setTimeout(function () {
        location.href = dest;
      }, 3200);
    }
  }

  /* Year interior */
  if (document.body.classList.contains("page-year")) {
    var st = readState();
    var params = new URLSearchParams(location.search);
    if (params.get("use")) st = writeState({ use: params.get("use") });

    var use = st.use || "year";
    $all("[data-use-switch] button").forEach(function (btn) {
      btn.classList.toggle("on", btn.getAttribute("data-use") === use);
      btn.addEventListener("click", function () {
        $all("[data-use-switch] button").forEach(function (b) { b.classList.remove("on"); });
        btn.classList.add("on");
        writeState({ use: btn.getAttribute("data-use") });
      });
    });

    var dateStr = [st.y, st.m, st.d].filter(Boolean).join(" · ");
    var calLabel = st.cal === "lunar" ? "陰曆" : (st.y || st.m || st.d ? "陽曆" : "—");
    if (!dateStr && calLabel === "陽曆") calLabel = "陽曆";
    if (!dateStr) calLabel = st.cal === "lunar" ? "陰曆" : (st.cal ? "陽曆" : "—");
    /* If nothing entered, show em dash for date; calendar only if they toggled and submitted */
    if (!dateStr) {
      calLabel = st.cal === "lunar" ? "陰曆" : (st.cal === "solar" ? "陽曆" : "—");
      /* default hidden field is solar even when empty — only show if any personal data exists */
      if (!st.y && !st.m && !st.d && !st.place && !st.gender && !st.time) calLabel = "—";
    }

    var map = {
      date: dateStr || "—",
      cal: calLabel,
      place: dash(st.place),
      gender: dash(st.gender),
      time: st.time && String(st.time).trim() ? st.time : "—"
    };
    Object.keys(map).forEach(function (k) {
      var el = $('[data-slot="' + k + '"]');
      if (el) {
        el.textContent = map[k];
        el.classList.toggle("empty", map[k] === "—");
      }
    });

    var emptyPillars = !dateStr;
    $all("[data-slot='py'],[data-slot='pm'],[data-slot='pd'],[data-slot='pt']").forEach(function (el) {
      el.textContent = "—";
    });
    var hourNote = $("[data-hours-note]");
    if (hourNote) hourNote.hidden = !!(st.time && String(st.time).trim());
    var pNote = $("[data-pillar-note]");
    if (pNote && dateStr) {
      pNote.textContent = "四柱在這次示範裡不代算，只留下你寫下的出生資料。";
    }

    function showView(name) {
      $all("[data-view]").forEach(function (sec) {
        var on = sec.getAttribute("data-view") === name;
        sec.hidden = !on;
        sec.classList.toggle("on", on);
      });
      $all("[data-view-tab]").forEach(function (a) {
        a.classList.toggle("on", a.getAttribute("data-view-tab") === name);
      });
    }
    $all("[data-view-tab]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        showView(a.getAttribute("data-view-tab"));
      });
    });
    $all("[data-to]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        showView(a.getAttribute("data-to"));
        var target = $('[data-view="' + a.getAttribute("data-to") + '"]');
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    var readings = [
      "先看這一年的節奏，再進入某一個月。不先下吉凶。",
      "開年的節奏較密，適合先把要做的事排開。",
      "步調可以慢一點，把還沒收好的事看完。",
      "選擇開始疊上來。先分開看，再決定先做哪一件。",
      "對外的事比較明顯。把要說清楚的話先寫下來。",
      "適合把已經開始的工作推完，不急於另開一條。",
      "中段容易分心。把一件事看完整，再接下一件。",
      "關係與合作會走到台前。這一處值得慢慢讀。",
      "收束的時機比開新的更重要。",
      "把帳算清楚，包括時間上的帳。",
      "可以回頭看前段走過的路，再決定餘下怎麼走。",
      "交代與交接會比較多。先列出來，再逐項處理。",
      "把這一年沒讀完的位置看完。不必提前寫下一年。"
    ];
    var titles = ["整年","一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
    var titleEl = $("[data-month-title]");
    var readEl = $("[data-month-read]");
    $all("[data-months] button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all("[data-months] button").forEach(function (b) { b.classList.remove("on"); });
        btn.classList.add("on");
        var i = parseInt(btn.getAttribute("data-month"), 10) || 0;
        if (titleEl) titleEl.textContent = titles[i];
        if (readEl) {
          readEl.textContent = readings[i];
          protectOrphans(readEl);
        }
      });
    });
  }

  if (document.body && !document.body.classList.contains("page-home")) {
    protectOrphans(document.body);
  } else if (document.body) {
    $all("main, .story, .offer, .wait, .site-foot, .gen-copy").forEach(protectOrphans);
  }
})();
