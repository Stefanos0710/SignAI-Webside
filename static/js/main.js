/* func to switch between win/macos/linux  */
// Nur auf der Index-Seite ausführen (nicht auf Download-Seite)
if (document.querySelector("#home") || document.querySelector("#desktop .hero-content")) {
    document.querySelectorAll(".platform").forEach(btn => {
        btn.addEventListener("click", (e) => {
            // Nur Buttons in der gleichen Section beeinflussen
            const section = btn.closest("section");

            // Toggle active state für Buttons in dieser Section
            section.querySelectorAll(".platform").forEach(b => {
                b.classList.toggle("active", b === btn);
                b.setAttribute("aria-selected", b === btn ? "true" : "false");
            });

            const os = btn.dataset.os;

            // Nur Devices in dieser Section umschalten
            section.querySelectorAll(".device").forEach(d => {
                d.classList.toggle("hidden", d.dataset.os !== os);
            });

            // Switch instruction links based on OS (nur in dieser Section)
            section.querySelectorAll(".instruction-link").forEach(link => {
                link.classList.toggle("hidden", link.dataset.osLink !== os);
            });
        });
    });
}

window.addEventListener("scroll", () => {
    const nav = document.getElementById("navbar");
    if (window.scrollY > 50) {
        nav.classList.add("scrolled");
    } else {
        nav.classList.remove("scrolled");
    };
});

// -------------------------
// Navbar toggle (hamburger)
// -------------------------
(function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const BREAKPOINT = 768;

    if (!navToggle || !navLinks) return;

    function openNav() {
        navToggle.classList.add('open');
        navLinks.classList.add('open');
        navToggle.setAttribute('aria-expanded', 'true');
        // prevent page from scrolling when menu open on small screens
        if (window.innerWidth <= BREAKPOINT) document.body.style.overflow = 'hidden';
    }

    function closeNav() {
        navToggle.classList.remove('open');
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    navToggle.addEventListener('click', (e) => {
        const isOpen = navToggle.classList.contains('open');
        if (isOpen) closeNav(); else openNav();
    });

    // Close the menu when a nav link is clicked (for one-page anchors)
    navLinks.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            if (window.innerWidth <= BREAKPOINT) closeNav();
        });
    });

    // Close menu on Escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNav();
    });

    // Close menu when resizing to large screens
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > BREAKPOINT) {
                closeNav();
            }
        }, 120);
    });
})();
