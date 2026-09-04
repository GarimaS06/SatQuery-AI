/* =========================================
   SATQUERY - SCROLL SATELLITE TRANSITION
   + MAGNETIC BUTTON
   ========================================= */

const hero = document.querySelector(".hero");
const sectionTwo = document.querySelector(".section-two");

const heroSatellite = document.querySelector(".satellite-image");
const explodedSatellite = document.querySelector(".phase-two-exploded");
const phaseTwoSatellite = document.querySelector(".phase-two-satellite");

let currentProgress = 0;
let targetProgress = 0;


/* =========================================
   CLAMP
   ========================================= */

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}


/* =========================================
   SCROLL PROGRESS
   ========================================= */

function updateScrollProgress() {

    if (!sectionTwo) return;

    const sectionTop = sectionTwo.offsetTop;

    const animationStart =
        window.innerHeight * 0.08;

    const animationEnd =
        sectionTop + window.innerHeight * 0.05;

    targetProgress = clamp(
        (window.scrollY - animationStart) /
        (animationEnd - animationStart),
        0,
        1
    );
}


/* =========================================
   SATELLITE ANIMATION
   ========================================= */

function animateSatellite() {

    currentProgress +=
        (targetProgress - currentProgress) * 0.12;

    const p = currentProgress;


    /* =====================================
       ORIGINAL SATELLITE
       ===================================== */

    if (heroSatellite) {

        const scale =
            1 - (p * 0.10);

        const moveX =
            p * -20;

        const moveY =
            p * -10;

        heroSatellite.style.transform =
            `translate(${moveX}px, ${moveY}px) scale(${scale})`;

        heroSatellite.style.opacity =
            1 - p;

        heroSatellite.style.visibility =
            p > 0.98 ? "hidden" : "visible";
    }


    /* =====================================
       EXPLODED SATELLITE
       ===================================== */

    if (explodedSatellite) {

        explodedSatellite.style.opacity = p;

        const explodedScale =
            0.92 + (p * 0.08);

        explodedSatellite.style.transform =
            `scale(${explodedScale})`;

        const explodedY =
            20 - (p * 20);

        explodedSatellite.style.marginTop =
            `${explodedY}px`;


        /* FLOAT AFTER FULL TRANSFORMATION */

        if (p >= 0.99) {

            explodedSatellite.classList.add(
                "float-final"
            );

        } else {

            explodedSatellite.classList.remove(
                "float-final"
            );
        }
    }


    requestAnimationFrame(animateSatellite);
}


/* =========================================
   SCROLL LISTENER
   ========================================= */

window.addEventListener(
    "scroll",
    updateScrollProgress,
    { passive: true }
);


/* =========================================
   MAGNETIC BUTTON
   ========================================= */

const magneticButtons =
    document.querySelectorAll(
        ".launch-button, .get-started"
    );


magneticButtons.forEach(button => {

    button.addEventListener("mousemove", (event) => {

        const rect =
            button.getBoundingClientRect();

        const x =
            event.clientX - rect.left - rect.width / 2;

        const y =
            event.clientY - rect.top - rect.height / 2;


        /*
           Magnetic strength.
           Lower = subtle.
           Higher = stronger.
        */

        const strength = 0.30;


        button.style.transform =
            `translate(${x * strength}px, ${y * strength}px)`;
    });


    button.addEventListener("mouseleave", () => {

        button.style.transform =
            "translate(0px, 0px)";
    });

});


/* =========================================
   INITIALIZE
   ========================================= */

updateScrollProgress();

animateSatellite();
/* =========================================
   SATQUERY - MOUSE PARALLAX
   ========================================= */

const heroSection = document.querySelector(".hero");
const satellite = document.querySelector(".satellite-image");

let mouseX = 0;
let mouseY = 0;

let currentMouseX = 0;
let currentMouseY = 0;


/* Track mouse position */

if (heroSection && satellite) {

    heroSection.addEventListener("mousemove", (e) => {

        const rect = heroSection.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        mouseX = (x - centerX) / centerX;
        mouseY = (y - centerY) / centerY;

    });


    /* Smooth movement */

    function mouseParallax() {

        currentMouseX +=
            (mouseX - currentMouseX) * 0.06;

        currentMouseY +=
            (mouseY - currentMouseY) * 0.06;


        /*
           Very subtle movement.
           Does NOT affect the scroll animation.
        */

        const moveX = currentMouseX * 12;
        const moveY = currentMouseY * 8;


        /*
           Only apply when the satellite
           is still visible.
        */

        if (window.scrollY < window.innerHeight * 0.9) {

            satellite.style.setProperty(
                "--mouse-x",
                `${moveX}px`
            );

            satellite.style.setProperty(
                "--mouse-y",
                `${moveY}px`
            );

        }


        requestAnimationFrame(mouseParallax);
    }


    mouseParallax();
}
/* =========================================
   SATELLITE MOUSE PARALLAX
   ========================================= */

const satelliteContainer =
    document.querySelector(".satellite-container");

if (satelliteContainer) {

    let mouseX = 0;
    let mouseY = 0;

    let currentX = 0;
    let currentY = 0;

    window.addEventListener("mousemove", (e) => {

        mouseX =
            (e.clientX / window.innerWidth - 0.5) * 20;

        mouseY =
            (e.clientY / window.innerHeight - 0.5) * 20;

    });

    function parallaxSatellite() {

        currentX +=
            (mouseX - currentX) * 0.06;

        currentY +=
            (mouseY - currentY) * 0.06;

        satelliteContainer.style.marginLeft =
            `${currentX}px`;

        satelliteContainer.style.marginTop =
            `${currentY}px`;

        requestAnimationFrame(parallaxSatellite);
    }

    parallaxSatellite();
}
