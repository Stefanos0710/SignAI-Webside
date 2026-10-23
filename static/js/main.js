// SignAI — site interactions (progressive enhancement: the site works without JS)
(function () {
    "use strict";

    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.getElementById("nav-menu");
    var BREAKPOINT = 1100;

    function storageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function storageSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }

    // -------------------------
    // Header style on scroll
    // -------------------------
    function onScroll() {
        if (!header) return;
        header.classList.toggle("is-scrolled", window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // -------------------------
    // Mobile navigation
    // -------------------------
    function setMenu(open) {
        if (!header || !toggle) return;
        header.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.querySelector(".sr-only").textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
        document.body.style.overflow = open && window.innerWidth <= BREAKPOINT ? "hidden" : "";
    }

    if (toggle && menu) {
        toggle.addEventListener("click", function () {
            setMenu(toggle.getAttribute("aria-expanded") !== "true");
        });
        menu.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () { setMenu(false); });
        });
        window.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && header.classList.contains("is-open")) {
                setMenu(false);
                toggle.focus();
            }
        });
        var resizeTimer;
        window.addEventListener("resize", function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (window.innerWidth > BREAKPOINT) setMenu(false);
            }, 120);
        });
    }

    // -------------------------
    // Language switcher: close on outside click / Escape
    // -------------------------
    var langSwitch = document.querySelector(".lang-switch");
    if (langSwitch) {
        document.addEventListener("click", function (e) {
            if (langSwitch.open && !langSwitch.contains(e.target)) langSwitch.open = false;
        });
        langSwitch.addEventListener("keydown", function (e) {
            if (e.key === "Escape") { langSwitch.open = false; langSwitch.querySelector("summary").focus(); }
        });
    }
    document.querySelectorAll("a[hreflang]").forEach(function (a) {
        a.addEventListener("click", function () { storageSet("signai-lang", a.getAttribute("hreflang")); });
    });

    // -------------------------
    // Cookie bar: GA runs cookieless (consent mode, see base.html) until "Accept"
    // -------------------------
    var cookieBar = document.querySelector(".cookie-bar");
    if (cookieBar) {
        if (!storageGet("signai-consent") || cookieBar.hasAttribute("data-always")) cookieBar.hidden = false;
        cookieBar.querySelectorAll("[data-consent]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                storageSet("signai-consent", btn.dataset.consent);
                if (typeof window.gtag === "function") window.gtag("consent", "update", { analytics_storage: btn.dataset.consent });
                cookieBar.hidden = true;
            });
        });
        document.querySelectorAll("[data-cookie-settings]").forEach(function (btn) {
            btn.addEventListener("click", function () { cookieBar.hidden = false; });
        });
    }

    // -------------------------
    // Language suggestion banner (never redirects)
    // -------------------------
    var banner = document.querySelector(".lang-banner");
    if (banner && !storageGet("signai-lang") && !storageGet("signai-lang-dismissed")) {
        var pageLang = document.body.dataset.lang;
        var offers = {};
        try { offers = JSON.parse(banner.dataset.offers || "{}"); } catch (e) { offers = {}; }
        var preferred = (navigator.languages || [navigator.language || ""]).map(function (l) {
            return String(l).slice(0, 2).toLowerCase();
        });
        var match = null;
        for (var i = 0; i < preferred.length; i++) {
            if (preferred[i] === pageLang) break;          // visitor already prefers this page's language
            if (offers[preferred[i]]) { match = offers[preferred[i]]; break; }
        }
        if (match) {
            banner.querySelector(".lang-banner-text").textContent = match.text;
            var link = banner.querySelector(".lang-banner-link");
            link.textContent = match.link;
            link.href = match.href + window.location.hash;
            banner.hidden = false;
            banner.querySelector(".lang-banner-close").addEventListener("click", function () {
                banner.hidden = true;
                storageSet("signai-lang-dismissed", "1");
            });
        }
    }

    // -------------------------
    // FAQ: keep one item open at a time; answers slide open and shut
    // -------------------------
    var FAQ_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";     // not EASE: the roadmap below has its own EASE number

    function slideFaq(item, open) {
        var answer = item.querySelector(".faq-a");
        if (reduceMotion || !answer.animate) { item.open = open; return; }
        item.classList.add("is-animating");
        if (open) {
            item.open = true;
            var to = getComputedStyle(answer);
            var anim = answer.animate([
                { height: "0px", paddingBottom: "0px", opacity: 0, transform: "translateY(-8px)" },
                { height: to.height, paddingBottom: to.paddingBottom, opacity: 1, transform: "none" }
            ], { duration: 380, easing: FAQ_EASE });
        } else {
            item.classList.add("is-closing");
            var from = getComputedStyle(answer);
            anim = answer.animate([
                { height: from.height, paddingBottom: from.paddingBottom, opacity: 1 },
                { height: "0px", paddingBottom: "0px", opacity: 0 }
            ], { duration: 280, easing: FAQ_EASE });
        }
        anim.onfinish = function () {
            if (!open) item.open = false;
            item.classList.remove("is-animating", "is-closing");
        };
    }

    document.querySelectorAll(".faq-list").forEach(function (list) {
        var items = list.querySelectorAll("details");
        items.forEach(function (item) {
            item.querySelector("summary").addEventListener("click", function (e) {
                e.preventDefault();
                if (item.classList.contains("is-animating")) return;
                var opening = !item.open;
                if (opening) items.forEach(function (other) { if (other.open && other !== item) slideFaq(other, false); });
                slideFaq(item, opening);
            });
            // Opened some other way (find-in-page, a link): still only one at a time
            item.addEventListener("toggle", function () {
                if (!item.open) return;
                items.forEach(function (other) { if (other !== item && !other.classList.contains("is-closing")) other.open = false; });
            });
        });
    });

    // -------------------------
    // "Notify me" sign-up
    // -------------------------
    var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

    document.querySelectorAll(".signup-form").forEach(function (form) {
        var status = form.querySelector(".form-status");
        var button = form.querySelector("button[type=submit]");
        var label = button.querySelector(".btn-label");
        var buttonText = label.textContent;
        var email = form.elements.email;
        var consent = form.elements.consent;

        consent.addEventListener("change", function () { consent.closest(".consent").classList.remove("is-invalid"); });

        function setStatus(message, isError) {
            status.textContent = message || "";
            status.classList.toggle("is-error", !!isError);
        }

        function done() {
            form.classList.add("is-done");
            form.querySelector(".form-success").hidden = false;
            if (typeof window.gtag === "function") window.gtag("event", "sign_up", { method: "notify_me" });
        }

        function mailFallback() {
            var body = form.dataset.mailBody + "\n\n" + email.value.trim() + " · " + form.dataset.lang;
            window.location.href = "mailto:hello@signai.dev?subject=" + encodeURIComponent(form.dataset.mailSubject) +
                "&body=" + encodeURIComponent(body);
            setStatus(form.dataset.msgFallback, false);
        }

        email.addEventListener("input", function () { email.removeAttribute("aria-invalid"); });

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!EMAIL_RE.test(email.value.trim())) {
                email.setAttribute("aria-invalid", "true");
                setStatus(form.dataset.msgEmail, true);
                email.focus();
                return;
            }
            if (!consent.checked) {
                setStatus(form.dataset.msgConsent, true);
                consent.closest(".consent").classList.add("is-invalid");
                consent.focus();
                return;
            }
            button.disabled = true;
            label.textContent = form.dataset.msgSending;
            setStatus("");

            fetch(form.action, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.value.trim(),
                    consent: true,
                    lang: form.dataset.lang,
                    source: form.dataset.source,
                    company: form.elements.company.value
                })
            }).then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (data) {
                    if (res.ok && data.ok) return done();
                    if (data.error === "invalid_email") return setStatus(form.dataset.msgEmail, true);
                    if (data.error === "rate_limited") return setStatus(form.dataset.msgLimit, true);
                    if (res.status >= 500) return mailFallback(); // never lose a sign-up to a server error
                    setStatus(form.dataset.msgError, true);
                });
            }).catch(function () {
                mailFallback();
            }).then(function () {
                button.disabled = false;
                label.textContent = buttonText;
            });
        });
    });

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -------------------------
    // Scroll reveal + count-up numbers ("~80.000", "70 Mio.+", "2002" keep their prefix, suffix and separator)
    // -------------------------
    function countUp(el) {
        var m = el.textContent.trim().match(/^(\D*?)(\d[\d.,\s  ]*\d|\d)(.*)$/);
        if (!m) return;
        var sep = m[2].replace(/\d/g, "").charAt(0);
        var target = parseInt(m[2].replace(/\D/g, ""), 10);
        var from = !sep && target > 1900 && target < 2100 ? target - 40 : 0;   // years count up from a few decades back, not from 0
        var start = null;
        function format(n) {
            var s = String(n);
            return sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : s;
        }
        function frame(t) {
            if (start === null) start = t;
            var p = Math.min((t - start) / 1200, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = m[1] + format(Math.round(from + (target - from) * eased)) + m[3];
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    // Keep in sync with the "Motion" selector list in site.css
    var REVEAL = "[data-reveal], .section-head, .split-copy, .mission-points, .steps, .streams, .principles, .features, .timeline, .cards, .contact-row, .faq-list, .signup, .sources-inner, .footer-brand, .footer-cols, .footer-bottom";
    var reveals = document.querySelectorAll(REVEAL);
    if (reduceMotion || !("IntersectionObserver" in window)) {
        reveals.forEach(function (el) { el.classList.add("is-in"); });
    } else {
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-in");
                entry.target.querySelectorAll("[data-count]").forEach(countUp);
                revealObserver.unobserve(entry.target);
            });
        }, { rootMargin: "0px 0px -8% 0px" });   // fires a little after the top edge shows; works for blocks taller than the screen too
        reveals.forEach(function (el) {
            Array.prototype.forEach.call(el.children, function (child, i) { child.style.setProperty("--i", Math.min(i, 8)); });
            revealObserver.observe(el);
        });
    }

    // Looping clips play only while on screen; with reduced motion the poster stays
    if (!reduceMotion && "IntersectionObserver" in window) {
        var clipObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) entry.target.play().catch(function () {});
                else entry.target.pause();
            });
        });
        document.querySelectorAll("video[data-autoplay]").forEach(function (v) { clipObserver.observe(v); });
    }

    // -------------------------
    // Soft scroll: a light easing for a mouse wheel (the notched kind). Trackpads, keys, the scrollbar, touch, pinch-zoom
    // and scrollable boxes keep their native feel, and nothing runs with reduced motion.
    // -------------------------
    if (!reduceMotion && !("ontouchstart" in window && window.innerWidth <= 900)) {
        var SOFT = 0.16;                                    // share of the remaining distance covered per frame (lower = softer)
        var SPEED = 0.55;                                   // how far a notch travels compared with a normal wheel (1 = as is)
        var softTarget = window.scrollY, softCur = window.scrollY, softLast = window.scrollY, softFrame = 0;
        var maxScroll = function () { return document.documentElement.scrollHeight - window.innerHeight; };
        var scrollsInside = function (el) {                // a nested box that can scroll on its own (menu, textarea ...)
            for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
                var oy = getComputedStyle(el).overflowY;
                if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) return true;
            }
            return false;
        };
        var softStep = function () {
            softCur += (softTarget - softCur) * SOFT;
            if (Math.abs(softTarget - softCur) < 0.5) { softCur = softTarget; softFrame = 0; } else softFrame = requestAnimationFrame(softStep);
            softLast = softCur;
            window.scrollTo({ top: softCur, behavior: "instant" });
        };
        window.addEventListener("wheel", function (e) {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;                 // zoom, horizontal
            if (e.deltaMode === 0 && Math.abs(e.deltaY) < 50) return;                               // small steps: a trackpad, leave it be
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || document.body.style.overflow === "hidden") return;
            if (scrollsInside(e.target)) return;
            e.preventDefault();
            if (!softFrame) softTarget = softCur = window.scrollY;                                  // start from wherever the page is
            softTarget = Math.min(Math.max(softTarget + e.deltaY * (e.deltaMode === 1 ? 40 : 1) * SPEED, 0), maxScroll());
            if (!softFrame) softFrame = requestAnimationFrame(softStep);
        }, { passive: false });
        // Scrolling that isn't ours (keys, scrollbar, links, the roadmap's pull) takes over from our target
        window.addEventListener("scroll", function () {
            if (Math.abs(window.scrollY - softLast) > 1.5) { cancelAnimationFrame(softFrame); softFrame = 0; softTarget = softCur = softLast = window.scrollY; }
        }, { passive: true });
    }

    // -------------------------
    // Header links to sections on this page: mark the section you are in, and when you arrive with a #hash
    // (from another page, or before fonts and images settled) put the section exactly where the link promises
    // -------------------------
    var spyLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a[href*='#']")).map(function (a) {
        var id = a.hash.slice(1), el = id && document.getElementById(id);
        return el && a.pathname === window.location.pathname ? { a: a, el: el } : null;
    }).filter(Boolean);
    if (spyLinks.length) {
        var spyNow = null, spyQueued = false;
        var spy = function () {
            spyQueued = false;
            var line = window.innerHeight * 0.4, hit = null;                                 // the section across this line is the current one
            spyLinks.forEach(function (l) { var r = l.el.getBoundingClientRect(); if (r.top <= line && r.bottom > line) hit = l; });
            if (hit === spyNow) return;
            spyNow = hit;
            spyLinks.forEach(function (l) { if (l === hit) l.a.setAttribute("aria-current", "location"); else l.a.removeAttribute("aria-current"); });
        };
        window.addEventListener("scroll", function () { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); } }, { passive: true });
        window.addEventListener("resize", spy);
        spy();
    }
    if (window.location.hash.length > 1) {
        var hashTarget = document.getElementById(decodeURIComponent(window.location.hash.slice(1))), moved = false;
        if (hashTarget) {
            ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (type) {
                window.addEventListener(type, function () { moved = true; }, { passive: true, once: true });
            });
            var realign = function () { if (!moved) hashTarget.scrollIntoView({ behavior: "instant" }); };
            if (document.readyState === "complete") realign(); else window.addEventListener("load", realign);
            if (document.fonts) document.fonts.ready.then(realign);
        }
    }

    // -------------------------
    // Roadmap: pin the timeline and move its steps past a fixed anchor as you scroll ("Timeline" in site.css)
    // -------------------------
    var track = document.querySelector(".tl-track");
    if (track && !reduceMotion) {
        var stage = track.querySelector(".tl-stage");
        var tlItems = Array.prototype.slice.call(track.querySelectorAll(".tl-item"));
        var GAP = 140, SMALL = 0.8;                         // px between steps; size of the steps around the active one (.tl-body scale)
        var full = [], small = [];
        var measureTimeline = function () {                // offsetHeight ignores the scaling, so this is each step at full size
            full = tlItems.map(function (it) { return it.firstElementChild.offsetHeight; });
            small = tlItems.map(function (it) { var t = it.querySelector(".tl-title"); return (t.offsetTop + t.offsetHeight) * SMALL; });
        };
        var rawNow = null, rawTarget = 0, easing = false;  // smoothed and actual scroll progress, in steps
        var EASE = 0.12;                                   // share of the remaining distance covered per frame
        var renderTimeline = function (raw) {
            var i0 = Math.min(Math.floor(raw), tlItems.length - 2);
            var f = Math.min(Math.max((raw - i0 - 0.2) / 0.6, 0), 1);
            var pos = i0 + f * f * (3 - 2 * f);           // rest on each step for a moment, then glide to the next
            // The active step takes its full height, the others only their date and title (v). Each step's dot sits at the
            // middle of its visible text (d), so the dot and the text are always level; t is a step's top
            var v = tlItems.map(function (it, i) { return small[i] + (full[i] - small[i]) * Math.max(0, 1 - Math.abs(i - pos)); });
            var t = [0];
            v.forEach(function (h, i) { t[i + 1] = t[i] + h + GAP; });
            var d = v.map(function (h, i) { return t[i] + h / 2; });
            var shift = d[i0] + (d[i0 + 1] - d[i0]) * (pos - i0);   // the line's tip (at pos) stays on the anchor
            track.style.setProperty("--pos", pos);
            tlItems.forEach(function (it, i) {
                it.style.setProperty("--y", (t[i] - shift) + "px");
                it.style.setProperty("--v", v[i] + "px");
                it.style.setProperty("--len", ((d[i + 1] || d[i]) - d[i]) + "px");
                it.style.setProperty("--a", Math.abs(i - pos));
                it.style.setProperty("--p", Math.min(Math.max(pos - i, 0), 1));
                it.classList.toggle("is-passed", i <= pos + 0.01);
                it.classList.toggle("is-active", i === Math.round(pos));
            });
        };
        // The steps ease toward the scroll position instead of following it frame for frame, so wheel notches and
        // trackpad flicks glide; jump = true snaps (first paint, resize)
        var easeTimeline = function () {
            rawNow += (rawTarget - rawNow) * EASE;
            if (Math.abs(rawTarget - rawNow) < 0.001) { rawNow = rawTarget; easing = false; }
            renderTimeline(rawNow);
            if (easing) requestAnimationFrame(easeTimeline);
        };
        var updateTimeline = function (jump) {
            var moved = stage.getBoundingClientRect().top - track.getBoundingClientRect().top;   // how far the pinned stage has travelled
            rawTarget = Math.min(Math.max(moved / (track.offsetHeight - stage.offsetHeight), 0), 1) * (tlItems.length - 1);
            if (jump === true || rawNow === null) { rawNow = rawTarget; renderTimeline(rawNow); }
            else if (!easing) { easing = true; requestAnimationFrame(easeTimeline); }
        };
        // Clicking a step, or tabbing to its link, scrolls to it
        var goToStep = function (e) {
            var i = tlItems.indexOf(e.target.closest(".tl-item"));
            if (i < 0 || tlItems[i].classList.contains("is-active")) return;
            var top = track.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(stage).top);
            window.scrollTo(0, top + (track.offsetHeight - stage.offsetHeight) * i / (tlItems.length - 1));
        };
        track.classList.add("tl-scroll");
        // A light magnet: once scrolling has stopped, a step you stopped close to (within PULL of a step) is drawn the
        // rest of the way in. Further away, nothing happens, so you can rest between steps and nothing fights you.
        var PULL = 0.2, SETTLE = 200, GLIDE = 650, magnetTimer, pullFrame = 0;   // reach in steps; ms of stillness; ms the pull takes
        var cancelPull = function () { cancelAnimationFrame(pullFrame); pullFrame = 0; };
        var pullBy = function (dy) {                        // a slow ease-in-out, softer than the browser's own smooth scroll
            var from = window.scrollY, t0 = performance.now();
            var tick = function (now) {
                var k = Math.min((now - t0) / GLIDE, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
                window.scrollTo({ top: from + dy * e, behavior: "instant" });
                pullFrame = k < 1 ? requestAnimationFrame(tick) : 0;
            };
            pullFrame = requestAnimationFrame(tick);
        };
        var magnet = function () {
            clearTimeout(magnetTimer);
            magnetTimer = setTimeout(function () {
                if (pullFrame) return;                                        // already gliding
                var span = track.offsetHeight - stage.offsetHeight;
                var moved = stage.getBoundingClientRect().top - track.getBoundingClientRect().top;
                if (span <= 0 || moved < 0 || moved > span) return;           // only while the stage is pinned
                var raw = moved / span * (tlItems.length - 1), near = Math.round(raw), off = near - raw;
                if (Math.abs(off) > 0.005 && Math.abs(off) < PULL) pullBy(off * span / (tlItems.length - 1));
            }, SETTLE);
        };
        // Any input of yours ends the pull at once
        ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (type) {
            window.addEventListener(type, cancelPull, { passive: true });
        });
        measureTimeline();
        updateTimeline(true);
        if (document.fonts) document.fonts.ready.then(function () { measureTimeline(); updateTimeline(true); });
        window.addEventListener("scroll", updateTimeline, { passive: true });
        window.addEventListener("scroll", magnet, { passive: true });
        window.addEventListener("resize", function () { measureTimeline(); updateTimeline(true); });
        track.addEventListener("click", goToStep);
        track.addEventListener("focusin", goToStep);
    }

    // -------------------------
    // Hero demo: replay real MediaPipe keypoints of signed DGS sentences as a drawn signer
    // -------------------------
    var demoFrame = document.querySelector("[data-signer]");
    var demoCanvas = demoFrame && demoFrame.querySelector(".signer-canvas");
    if (demoCanvas && demoCanvas.getContext && window.fetch) startSigner(demoFrame, demoCanvas);
    else if (demoFrame) demoFrame.classList.add("is-static");

    function startSigner(frame, canvas) {
        var urls = JSON.parse(frame.dataset.signer);
        var texts = JSON.parse(frame.dataset.texts);
        var errors = JSON.parse(frame.dataset.errors || "[]");
        var timing = JSON.parse(frame.dataset.timing || "[]");
        var ctx = canvas.getContext("2d");
        var figure = frame.closest(".demo");
        var captionEl = frame.querySelector(".demo-caption");
        var SPEED = 0.7;                                   // slow the 25 fps clips down for readability
        var IN_MS = 1100;                                  // from the rest pose into the sentence
        var SETTLE_MS = 1000;                              // from the last sign back into the rest pose
        var HOLD_MS = 1900;                                // resting, caption up
        var VH = 340;                                      // drawing height: the clips' 400×300 stage, framed a bit taller (see .demo-frame)
        var ZOOM = 1.15, ZOOM_Y = 127;                     // draw the signer a bit larger; scaling around y=127 puts the head near the top, level with the headline
        var rest = null;                                   // relaxed pose between sentences
        var COL = { body: "170,182,255", r: "146,163,255", l: "47,208,162", face: "205,212,255", mouth: "47,208,162" };
        var clip = null, next = null, idx = 0, S;
        var shownCaption = null, lastState = null, words = [], slips = {}, wasWrong = {}, spans = [], fresh = false, wordAt = [];

        var cache = {};
        function load(i) {
            if (!cache[i]) {
                cache[i] = fetch(urls[i]).then(function (r) {
                    if (!r.ok) throw new Error(r.status);
                    return r.json();
                });
                cache[i].catch(function () { delete cache[i]; });
            }
            return cache[i];
        }

        function setClip(i, data) {
            idx = i;
            clip = data;
            clip.signMs = data.frames.length / data.fps / SPEED * 1000;
            S = data.shapes;
            // Words as the recogniser emits them; stand-alone punctuation joins the word before it
            words = [];
            (texts[i] || "").split(" ").forEach(function (w) {
                if (/^[!?:;–—]+$/.test(w) && words.length) words[words.length - 1] += " " + w;
                else words.push(w);
            });
            // Planned recognition slips: index -> { wrong guess, corrected on "next" word or at the "end" }
            slips = {};
            wasWrong = {};
            fresh = true;                                  // cleared when this sentence's first word arrives
            // When each word appears: right after the sign it depends on has been signed
            var ends = data.signs || [data.frames.length - 1], G = ends.length, N = data.frames.length;
            var map = timing[i] && timing[i].length === words.length ? timing[i] : null;
            var gap = 140 / clip.signMs;                   // words of one sign arrive in a quick burst
            wordAt = words.map(function (w, j) {
                var g = map ? map[j] : Math.ceil((j + 1) * G / words.length) - 1;
                return progressAt(Math.min(N - 1, ends[Math.min(g, G - 1)] + 3) / (N - 1));   // ~0.15 s recognition delay
            });
            for (var j = 1; j < wordAt.length; j++) wordAt[j] = Math.max(wordAt[j], wordAt[j - 1] + gap);
            // Short sentences come out right straight away; only longer ones get a slip or two
            (words.length > 4 ? errors[i] || [] : []).forEach(function (e) {
                for (var j = 0; j < words.length; j++) {
                    if (words[j].split(" ")[0] === e[0] && !slips[j]) { slips[j] = { wrong: e[1], fix: e[2] }; break; }
                }
            });
            shownCaption = null;
            next = null;
            load((i + 1) % urls.length).then(function (d) { next = d; }, function () { /* stay on this clip */ });
        }

        function resize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var w = canvas.clientWidth || 400;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(w * VH / 400 * dpr);
            ctx.setTransform(canvas.width / 400, 0, 0, canvas.height / VH, 0, 0);
        }
        window.addEventListener("resize", function () { resize(); if (lastState) draw(lastState); });

        // ---- geometry helpers ----
        var KEYS = ["p", "f", "r", "l", "pz", "rz", "lz"];
        function lerpVal(a, b, t) {
            if (a == null || b == null) return a == null ? b : a;
            if (typeof a === "number") return a + (b - a) * t;
            return a.map(function (v, i) { return lerpVal(v, b[i], t); });
        }
        function mix(a, b, t) {
            var o = {};
            KEYS.forEach(function (k) { o[k] = lerpVal(a[k], b[k], t); });
            return o;
        }
        function at(c, f) {                                // interpolated pose of clip c at fractional frame f
            var F = c.frames, N = F.length;
            var i = Math.max(0, Math.min(N - 1, Math.floor(f))), j = Math.min(N - 1, i + 1), t = Math.max(0, Math.min(1, f - i));
            return mix(F[i], F[j], t);
        }
        function pick(pts, ids) { return ids.map(function (i) { return pts[i]; }); }
        // Smooth outline through points (midpoint quadratic curves)
        function smooth(pts, closed) {
            ctx.beginPath();
            var n = pts.length;
            if (!closed) {
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (var i = 1; i < n - 1; i++) {
                    ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
                }
                ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
                return;
            }
            ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
            for (var k = 0; k < n; k++) {
                var p = pts[k], q = pts[(k + 1) % n];
                ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
            }
            ctx.closePath();
        }
        // Open path through points, smoothed with midpoint quadratics (appends to the current path)
        function smoothPath(pts) {
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (var i = 1; i < pts.length - 1; i++) {
                ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
            }
            var last = pts[pts.length - 1];
            ctx.lineTo(last[0], last[1]);
        }

        // ---- depth: nothing rotates, but nearer parts read as nearer ----
        // z is relative to the shoulders, negative = towards the camera
        function near(z) { return Math.max(-1, Math.min(1, -(z || 0) / 45)); }
        var SHADOW = false;                                // true while drawing the cast shadow
        var LIGHT = [9, 11];                              // shadow offset on the back wall at shoulder depth

        // ---- the signer, drawn as smooth keypoint lines ----
        var dots = null;
        function backdrop() {
            var g = ctx.createRadialGradient(200, 125, 20, 200, 160, 270);
            g.addColorStop(0, "#28306a");
            g.addColorStop(1, "#0d1130");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 400, VH);
            if (!dots) {                                   // dot grid, rendered once
                dots = document.createElement("canvas");
                dots.width = 400 * 2;
                dots.height = VH * 2;
                var d = dots.getContext("2d");
                d.scale(2, 2);
                d.fillStyle = "rgba(255,255,255,0.1)";
                for (var x = 10; x < 400; x += 16) {
                    for (var y = 10; y < VH; y += 16) { d.beginPath(); d.arc(x, y, 0.7, 0, 6.283); d.fill(); }
                }
            }
            ctx.drawImage(dots, 0, 0, 400, VH);
        }

        // k: -1 far ... 0 shoulder plane ... 1 near
        function stroke(rgb, alpha, width, glow, k) {
            k = k || 0;
            ctx.lineWidth = width * (1 + 0.55 * k);
            if (SHADOW) {
                ctx.strokeStyle = "rgba(3,5,20,0.6)";
                ctx.shadowBlur = 0;
            } else {
                ctx.strokeStyle = "rgba(" + rgb + "," + Math.min(1, alpha * (0.78 + 0.3 * k)) + ")";
                ctx.shadowColor = glow ? "rgba(" + rgb + "," + (0.35 + 0.3 * Math.max(0, k)) + ")" : "transparent";
                ctx.shadowBlur = glow ? glow * (1 + 0.7 * k) : 0;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        function dot(p, r, color, k) {
            if (SHADOW) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p[0], p[1], r * (1 + 0.45 * (k || 0)), 0, 6.283);
            ctx.fill();
        }

        function torso(s) {
            var P = s.p, z = s.pz || [];
            var chin = s.f[S.chin[0]];                      // fixed landmark: no jumping neck
            var mid = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2];
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            if (!SHADOW) {
                // Torso sides fade out towards the hips
                [[P[0], P[6]], [P[1], P[7]]].forEach(function (seg) {
                    var g = ctx.createLinearGradient(seg[0][0], seg[0][1], seg[1][0], seg[1][1]);
                    g.addColorStop(0, "rgba(" + COL.body + ",0.5)");
                    g.addColorStop(0.65, "rgba(" + COL.body + ",0)");
                    ctx.strokeStyle = g;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(seg[0][0], seg[0][1]);
                    ctx.lineTo(seg[1][0], seg[1][1]);
                    ctx.stroke();
                });
            }
            // Shoulders as one soft curve through the neck, neck up to the chin
            ctx.beginPath();
            ctx.moveTo(P[0][0], P[0][1]);
            ctx.quadraticCurveTo(mid[0], mid[1] - 6, P[1][0], P[1][1]);
            ctx.moveTo(mid[0], mid[1] - 3);
            ctx.lineTo(chin[0], chin[1] + 3);
            stroke(COL.body, 0.75, 2.4, 0, 0);
            dot(P[0], 2.4, "#fff", near(z[0]));
            dot(P[1], 2.4, "#fff", near(z[1]));
        }

        function arm(sh, el, wr, zs, ze, zw) {
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(sh[0], sh[1]);
            ctx.lineTo(el[0], el[1]);
            stroke(COL.body, 0.85, 2.6, 6, near((zs + ze) / 2));
            ctx.beginPath();
            ctx.moveTo(el[0], el[1]);
            ctx.lineTo(wr[0], wr[1]);
            stroke(COL.body, 0.85, 2.6, 6, near((ze + zw) / 2));
            dot(el, 2.4, "#fff", near(ze));
        }

        function face(f) {
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            smooth(pick(f, S.oval), true);
            stroke(COL.face, 0.55, 1.1, 0, 0);
            if (SHADOW) return;
            ["browL", "browR"].forEach(function (k) {
                var b = pick(f, S[k]);
                smooth(b.slice(0, b.length / 2), false);   // upper edge only reads as a brow line
                stroke(COL.face, 0.75, 1.3, 0, 0);
            });
            ["eyeL", "eyeR"].forEach(function (k) {
                smooth(pick(f, S[k]), true);
                stroke(COL.face, 0.8, 1, 0, 0);
            });
            S.iris.forEach(function (i) { dot(f[i], 1.3, "rgba(" + COL.face + ",0.95)", 0); });
            smooth(pick(f, S.nose).slice(1), false);
            stroke(COL.face, 0.45, 1, 0, 0.3);
            // Mouth in the accent colour: mouthings carry meaning in DGS
            smooth(pick(f, S.lipOut), true);
            stroke(COL.mouth, 0.95, 1.4, 6, 0.2);
            smooth(pick(f, S.lipIn), true);
            stroke(COL.mouth, 0.6, 1, 0, 0.2);
        }

        var FINGERS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20]];
        function hand(h, hz, rgb) {
            hz = hz || [];
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            // knuckle line first, then fingers from far to near so overlaps sit right
            ctx.beginPath();
            smoothPath([h[5], h[9], h[13], h[17]]);
            stroke(rgb, 0.95, 1.8, 8, near((hz[5] + hz[17]) / 2));
            FINGERS.map(function (chain) {
                var z = 0;
                chain.forEach(function (i) { z += hz[i] || 0; });
                return { chain: chain, z: z / chain.length };
            }).sort(function (a, b) { return b.z - a.z; }).forEach(function (fg) {
                ctx.beginPath();
                smoothPath(pick(h, fg.chain));
                stroke(rgb, 0.95, 1.8, 8, near(fg.z));
                var tip = fg.chain[fg.chain.length - 1];
                dot(h[tip], 1.7, "#fff", near(hz[tip]));
            });
            dot(h[0], 2, "#fff", near(hz[0]));
        }

        var trail = { r: [], l: [] };
        function trails(s) {
            ["r", "l"].forEach(function (k) {
                if (!s[k]) return;
                var t = trail[k];
                t.push(s[k][9]);
                if (t.length > 14) t.shift();
                for (var i = 1; i < t.length; i++) {
                    ctx.strokeStyle = "rgba(" + COL[k] + "," + (i / t.length * 0.3) + ")";
                    ctx.lineWidth = i / t.length * 2.5;
                    ctx.beginPath();
                    ctx.moveTo(t[i - 1][0], t[i - 1][1]);
                    ctx.lineTo(t[i][0], t[i][1]);
                    ctx.stroke();
                }
            });
        }

        // Everything except the background, ordered back to front
        function drawFigure(s) {
            var P = s.p, z = s.pz || [0, 0, 0, 0, 0, 0, 0, 0];
            torso(s);
            var parts = [
                { z: 0, draw: function () { face(s.f); } },
                { z: s.lz ? s.lz[9] : z[4], draw: function () {
                    arm(P[0], P[2], s.l ? s.l[0] : P[4], z[0], z[2], z[4]);
                    if (s.l) hand(s.l, s.lz, COL.l);
                } },
                { z: s.rz ? s.rz[9] : z[5], draw: function () {
                    arm(P[1], P[3], s.r ? s.r[0] : P[5], z[1], z[3], z[5]);
                    if (s.r) hand(s.r, s.rz, COL.r);
                } }
            ];
            parts.sort(function (a, b) { return b.z - a.z; }).forEach(function (o) { o.draw(); });
        }

        // The shadow on the back wall: parts nearer the camera throw it further
        function shifted(s) {
            function move(pts, zs, zDefault) {
                if (!pts) return pts;
                return pts.map(function (p, i) {
                    var k = 1 + 1.2 * near(zs ? zs[i] : zDefault);
                    return [p[0] + LIGHT[0] * k, p[1] + LIGHT[1] * k];
                });
            }
            var o = mix(s, s, 0);
            o.p = move(s.p, s.pz, 0);
            o.f = move(s.f, null, 0);
            o.r = move(s.r, s.rz, 0);
            o.l = move(s.l, s.lz, 0);
            return o;
        }

        var canBlur = "filter" in ctx;
        function draw(s) {
            lastState = s;
            backdrop();
            ctx.save();
            ctx.translate(200, ZOOM_Y);
            ctx.scale(ZOOM, ZOOM);
            ctx.translate(-200, -ZOOM_Y);
            ctx.save();
            if (canBlur) ctx.filter = "blur(3px)";
            SHADOW = true;
            drawFigure(shifted(s));
            SHADOW = false;
            ctx.restore();
            trails(s);
            drawFigure(s);
            ctx.restore();
        }

        // "off": hidden. "live": the translation builds up word by word while signing (provisional).
        // "final": the finished translation.
        // "off": hidden. "live": the recogniser emits words one by one while the signing runs,
        // sometimes guessing wrong and correcting itself (with the next word or at the end).
        // "final": the finished translation.
        function caption(mode, p) {
            var k = words.length;
            if (mode === "live") for (k = 0; k < words.length && wordAt[k] <= p; k++);
            var key = mode + k;
            if (key === shownCaption) return;
            shownCaption = key;
            captionEl.classList.toggle("is-shown", mode === "final" || (mode === "live" && p > 0.04));
            figure.classList.toggle("is-reading", mode === "live");
            figure.classList.toggle("is-done", mode === "final");
            if (mode === "off") return;                    // fade out with the last text
            captionEl.classList.toggle("is-final", mode === "final");
            var line = captionEl.firstElementChild;
            if (fresh) { line.textContent = ""; spans = []; fresh = false; }
            for (var j = 0; j < k; j++) {
                if (!spans[j]) {                           // a new word arrives
                    if (j) line.appendChild(document.createTextNode(" "));
                    spans[j] = line.appendChild(document.createElement("span"));
                    spans[j].className = "w";
                }
                var slip = slips[j], text = words[j];
                var wrong = !!slip && mode === "live" && (slip.fix === "end" || j === k - 1);
                if (wrong) text = slip.wrong + text.slice(text.split(" ")[0].length);
                if (spans[j].textContent !== text) spans[j].textContent = text;
                spans[j].classList.toggle("is-guess", wrong);
                if (wasWrong[j] && !wrong) spans[j].classList.add("is-fixed");   // the correction lights up
                wasWrong[j] = wrong;
            }
        }

        // Each sentence eases in and out so the hands start and stop softly
        function playback(p) { return p - Math.sin(2 * Math.PI * p) * 0.055; }
        function progressAt(f) {                           // inverse of playback(): when is frame share f reached
            var lo = 0, hi = 1;
            for (var it = 0; it < 24; it++) { var m = (lo + hi) / 2; if (playback(m) < f) lo = m; else hi = m; }
            return hi;
        }
        function ease(b) { return b < 0.5 ? 4 * b * b * b : 1 - Math.pow(-2 * b + 2, 3) / 2; }
        // Resting is not frozen: a slow breath lifts shoulders and head a little
        function resting(ms) {
            var o = mix(rest, rest, 0), dy = Math.sin(ms / 3400 * 2 * Math.PI) * 0.9;
            function lift(pts, k) { return pts && pts.map(function (q) { return [q[0], q[1] - dy * k]; }); }
            o.p = o.p.map(function (q, i) { return [q[0], q[1] - dy * (i < 2 ? 1 : i < 4 ? 0.6 : i < 6 ? 0.25 : 0)]; });
            o.f = lift(o.f, 1.1);
            o.r = lift(o.r, 0.25);
            o.l = lift(o.l, 0.25);
            return o;
        }

        var visible = true, t = 0, prev = null, clock = 0;
        function tick(now) {
            requestAnimationFrame(tick);
            if (!visible) { prev = null; return; }
            var dt = prev === null ? 0 : Math.max(0, Math.min(now - prev, 50));   // no jumps after the tab was hidden
            prev = now;
            t += dt;
            clock += dt;
            var N = clip.frames.length, state;
            var tSign = IN_MS, tSettle = tSign + clip.signMs, tHold = tSettle + SETTLE_MS, tEnd = tHold + HOLD_MS;
            if (t < tSign) {                               // rest -> first sign
                state = mix(resting(clock), at(clip, 0), ease(t / IN_MS));
                caption("off");
                trail.r.length = trail.l.length = 0;
            } else if (t < tSettle) {
                var p = (t - tSign) / clip.signMs;
                state = at(clip, playback(p) * (N - 1));
                caption("live", p);
            } else if (t < tHold) {                        // the hands come down, the translation completes
                state = mix(at(clip, N - 1), resting(clock), ease((t - tSettle) / SETTLE_MS));
                // words from the last sign still arrive live, then the translation is final
                var late = 1 + (t - tSettle) / clip.signMs;
                if (late < wordAt[wordAt.length - 1] + 220 / clip.signMs) caption("live", late);
                else caption("final");
            } else {
                state = resting(clock);
                caption("final");
                if (t >= tEnd && next) { setClip((idx + 1) % urls.length, next); t = 0; }
            }
            draw(state);
        }

        Promise.all([load(0), fetch(frame.dataset.rest).then(function (r) { return r.json(); })]).then(function (res) {
            var data = res[0];
            rest = res[1];
            captionEl.classList.remove("is-shown");        // the fallback's caption stays hidden; the first sentence types itself in
            frame.classList.add("is-live");
            resize();
            setClip(0, data);
            if (reduceMotion) {                            // one still frame, everything filled in
                draw(at(clip, clip.frames.length * 0.55));
                caption("final");
                return;
            }
            if ("IntersectionObserver" in window) {
                new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(frame);
            }
            requestAnimationFrame(tick);
        }, function () { frame.classList.add("is-static"); });   // show the static fallback
    }
})();
