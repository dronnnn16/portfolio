/* Dron | Video Editor — interactions (vanilla, no dependencies) */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STAGGER = 0.08; // seconds between siblings in a reveal group
  var HERO_DELAY = 0.1; // first hero item waits a beat after load

  /* ---------------------------------------------------------------
     Reveal stagger: children of a [data-reveal-group] get a delay
     based on their order in the group.
     --------------------------------------------------------------- */
  document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
    var base = group.closest(".intro") ? HERO_DELAY : 0;
    group.querySelectorAll("[data-reveal]").forEach(function (el, i) {
      el.style.setProperty("--d", (base + i * STAGGER).toFixed(2) + "s");
    });
  });
  // the side card enters right after the main hero card's first lines
  var side = document.querySelector(".intro__side");
  if (side) side.style.setProperty("--d", HERO_DELAY + STAGGER * 2 + "s");

  /* ---------------------------------------------------------------
     Counter: <span data-counter data-to="150" data-suffix="+">
     --------------------------------------------------------------- */
  function formatCount(el, value) {
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    return prefix + value.toFixed(decimals) + suffix;
  }

  function runCounter(el) {
    var to = parseFloat(el.getAttribute("data-to")) || 0;
    if (reduceMotion) {
      el.textContent = formatCount(el, to);
      return;
    }
    var duration = 1600;
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / duration, 1);
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // easeOutExpo
      el.textContent = formatCount(el, to * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------
     One IntersectionObserver for every reveal and counter
     --------------------------------------------------------------- */
  var targets = document.querySelectorAll("[data-reveal], [data-counter]");

  function reveal(el) {
    el.classList.add("is-in");
    if (el.hasAttribute("data-counter")) runCounter(el);
  }

  var io = null;
  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach(reveal);
  } else {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });

    // wait two frames so the hidden start state is painted before the
    // hero entrance kicks in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        targets.forEach(function (el) { io.observe(el); });
      });
    });
  }

  /* ---------------------------------------------------------------
     Infinite marquee: duplicate the track for a seamless loop
     --------------------------------------------------------------- */
  document.querySelectorAll("[data-marquee]").forEach(function (marquee) {
    var track = marquee.querySelector(".marquee__track");
    if (!track) return;
    var inner = document.createElement("div");
    inner.className = "marquee__inner";
    track.parentNode.insertBefore(inner, track);
    inner.appendChild(track);
    var clone = track.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a").forEach(function (a) { a.setAttribute("tabindex", "-1"); });
    inner.appendChild(clone);

    // constant speed regardless of how many logos there are (~40px/s)
    function setSpeed() {
      var w = track.getBoundingClientRect().width;
      if (w) marquee.style.setProperty("--marquee-dur", Math.round(w / 40) + "s");
    }
    setSpeed();
    window.addEventListener("resize", setSpeed, { passive: true });
  });

  /* ---------------------------------------------------------------
     Nav: mobile menu + scrolled state
     --------------------------------------------------------------- */
  var nav = document.querySelector("[data-nav]");
  var toggle = document.querySelector("[data-nav-toggle]");

  function setMenu(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });
    nav.querySelectorAll(".nav__links a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("is-open") && !nav.contains(e.target)) setMenu(false);
    });
    window.matchMedia("(min-width: 810px)").addEventListener("change", function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------------------------------------------------------------
     Scroll: progress bar, nav state, subtle parallax (one rAF loop)
     --------------------------------------------------------------- */
  var parallax = reduceMotion ? [] : Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.scrollY || root.scrollTop;
    var max = root.scrollHeight - root.clientHeight;
    root.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : "0");
    if (nav) nav.classList.toggle("is-scrolled", y > 8);
    // at the very bottom, the -8% root margin can keep the last items
    // from ever intersecting: reveal whatever is left
    if (io && max > 0 && y >= max - 2) {
      document.querySelectorAll("[data-reveal]:not(.is-in)").forEach(reveal);
    }

    var vh = window.innerHeight;
    parallax.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var factor = parseFloat(el.getAttribute("data-parallax")) || 0;
      el.style.transform = "translate3d(0," + (y * factor).toFixed(1) + "px,0)";
    });
  }

  function requestScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }

  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------
     Custom cursor: ring (eased follow) + dot, ring grows on links
     --------------------------------------------------------------- */
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var ring = document.querySelector(".cursor");
  var dot = document.querySelector(".cursor-dot");

  if (finePointer && !reduceMotion && ring && dot) {
    var mx = 0, my = 0, rx = 0, ry = 0, running = false, shown = false;

    function follow() {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      // position via `translate` so the CSS `scale` hover state grows the
      // ring in place instead of scaling its offset
      ring.style.translate = rx.toFixed(1) + "px " + ry.toFixed(1) + "px";
      if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) {
        requestAnimationFrame(follow);
      } else {
        running = false;
      }
    }

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      dot.style.translate = mx + "px " + my + "px";
      if (!shown) {
        rx = mx;
        ry = my;
        shown = true;
        ring.classList.add("is-visible");
        dot.classList.add("is-visible");
      }
      if (!running) {
        running = true;
        requestAnimationFrame(follow);
      }
    }, { passive: true });

    document.addEventListener("mouseleave", function () {
      shown = false;
      ring.classList.remove("is-visible");
      dot.classList.remove("is-visible");
    });

    document.addEventListener("mouseover", function (e) {
      var hot = !!(e.target.closest && e.target.closest("a, button, [role='button']"));
      ring.classList.toggle("is-hot", hot);
      dot.classList.toggle("is-hot", hot);
    });
  }
})();
