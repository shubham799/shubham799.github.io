/* ==========================================================
   Shubham Panwar — Portfolio scripts
   1. Theme toggle (light/dark, remembers your choice)
   2. Mobile menu
   3. Highlight the nav link for the section in view
   4. Footer year
   5. Scroll-reveal animations
   6. Hero background contour lines
   ========================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- 1. Theme toggle ---------- */
  var themeToggle = document.querySelector('.theme-toggle');
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // The theme actually on screen: an explicit choice, else the OS preference.
  function currentTheme() {
    var chosen = root.getAttribute('data-theme');
    if (chosen === 'light' || chosen === 'dark') return chosen;
    return darkQuery.matches ? 'dark' : 'light';
  }

  function updateToggleLabel() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }

  themeToggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
    updateToggleLabel();
  });

  // If no explicit choice was made, follow OS changes live.
  darkQuery.addEventListener('change', updateToggleLabel);
  updateToggleLabel();

  /* ---------- 2. Mobile menu ---------- */
  var menuToggle = document.querySelector('.nav__toggle');
  var menu = document.getElementById('nav-menu');

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  menuToggle.addEventListener('click', function () {
    setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  // Close after choosing a link
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) setMenu(false);
  });

  // Close on Escape and return focus to the button
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      setMenu(false);
      menuToggle.focus();
    }
  });

  // Close when clicking outside the nav
  document.addEventListener('click', function (event) {
    if (menu.classList.contains('is-open') && !event.target.closest('.nav')) {
      setMenu(false);
    }
  });

  /* ---------- 3. Active nav link ---------- */
  var navLinks = menu.querySelectorAll('a[href^="#"]');
  var sections = [];
  navLinks.forEach(function (link) {
    var section = document.querySelector(link.getAttribute('href'));
    if (section) sections.push(section);
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var active = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' }); // a thin band around the middle of the viewport

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---------- 4. Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- 5. Scroll-reveal animations ---------- */
  // Elements that fade up as they scroll into view. Siblings of the same
  // kind (chips groups, cards) are staggered slightly. Edit the list to taste.
  var revealSelectors = [
    '.section .label',
    '.section__title',
    '.about__text',
    '.stat',
    '.skill-group',
    '.timeline__item',
    '.project',
    '.edu',
    '.contact'
  ];
  var STAGGER_MS = 70;   // delay between siblings
  var MAX_DELAY_MS = 350;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target); // animate once only
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealSelectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el) {
        // Stagger by position among siblings that share this selector
        var siblings = Array.prototype.filter.call(el.parentElement.children, function (child) {
          return child.matches(selector);
        });
        var index = siblings.indexOf(el);
        el.style.setProperty('--delay', Math.min(index * STAGGER_MS, MAX_DELAY_MS) + 'ms');
        el.classList.add('reveal');
        revealObserver.observe(el);
      });
    });

    // The timeline's vertical line draws itself in
    var timeline = document.querySelector('.timeline');
    if (timeline) revealObserver.observe(timeline);
  } else {
    // No animation: make sure nothing stays hidden
    var tl = document.querySelector('.timeline');
    if (tl) tl.classList.add('is-visible');
  }

  /* ---------- 6. Hero background contour lines ---------- */
  // Draws irregular, topographic-style rings into the empty <svg id="hero-contours">.
  // Tweak the settings below to change the look.
  var contourSvg = document.getElementById('hero-contours');
  if (contourSvg) {
    var CONTOUR = {
      cx: 1190, cy: 70,     // centre of the rings (viewBox is 1280 x 480; keep near the right edge)
      rings: 22,            // number of rings
      startRadius: 24,      // radius of the innermost ring
      spacing: 26,          // gap between rings
      accentEvery: 5,       // every Nth ring is green
      wobble: 0.16          // how irregular the rings are (0 = perfect circles)
    };
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var STEPS = 72; // points per ring

    // Fixed "random" harmonics so the shape is the same on every visit
    var harmonics = [
      { k: 2, amp: 0.45, phase: 0.6 },
      { k: 3, amp: 0.30, phase: 2.1 },
      { k: 5, amp: 0.15, phase: 4.0 },
      { k: 7, amp: 0.10, phase: 1.3 }
    ];

    var group = document.createElementNS(SVG_NS, 'g');

    for (var i = 0; i < CONTOUR.rings; i++) {
      var base = CONTOUR.startRadius + i * CONTOUR.spacing;
      var twist = i * 0.07; // each ring shifts slightly, like terrain
      var points = [];

      for (var s = 0; s < STEPS; s++) {
        var theta = (s / STEPS) * Math.PI * 2;
        var offset = 0;
        harmonics.forEach(function (h) {
          offset += h.amp * Math.sin(h.k * theta + h.phase + twist);
        });
        var r = base * (1 + CONTOUR.wobble * offset);
        points.push([CONTOUR.cx + r * Math.cos(theta), CONTOUR.cy + r * Math.sin(theta)]);
      }

      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', smoothClosedPath(points));
      var isAccent = (i + 1) % CONTOUR.accentEvery === 0;
      path.setAttribute('class', isAccent ? 'contour contour--accent' : 'contour');
      // Inner rings are a touch stronger than outer ones
      var fade = 1 - i / CONTOUR.rings;
      path.setAttribute('opacity', ((isAccent ? 0.35 : 0.14) * (0.5 + 0.5 * fade)).toFixed(3));
      group.appendChild(path);
    }

    // Very slow rotation around the rings' centre (one turn every 4 minutes)
    if (!reduceMotion) {
      var spin = document.createElementNS(SVG_NS, 'animateTransform');
      spin.setAttribute('attributeName', 'transform');
      spin.setAttribute('type', 'rotate');
      spin.setAttribute('from', '0 ' + CONTOUR.cx + ' ' + CONTOUR.cy);
      spin.setAttribute('to', '360 ' + CONTOUR.cx + ' ' + CONTOUR.cy);
      spin.setAttribute('dur', '240s');
      spin.setAttribute('repeatCount', 'indefinite');
      group.appendChild(spin);
    }

    contourSvg.appendChild(group);
  }

  // Turns a closed list of points into a smooth curve (Catmull-Rom to Bezier)
  function smoothClosedPath(pts) {
    var n = pts.length;
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
           ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d + 'Z';
  }
})();
