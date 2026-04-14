

const animations = {
    triangleCanvas: () => import('./webgputriangle.js'),
    cubeCanvas: () => import('./webgpucube.js'),
    cubeCanvasThree: () => import('./threecube.js'),
    starsCanvasThree: () => import('./threestars.js'),
    oceanCanvas: () => import('./threeocean.js'),
    textFloatCanvas: () => import('./threetextfloat.js'),
    morphingCanvas: () => import('./threemorphing.js'),
    particlesLogoCanvas: () => import('./threeparticleslogo.js'),
    wormholeCanvas: () => import('./threewormhole.js'),
    terrainCanvas: () => import('./threeterrain.js'),
    bloomCanvas: () => import('./threebloom.js'),
    waterCanvas: () => import('./threewater.js'),
    gameOfLifeCanvas: () => import('./threegameoflife.js'),
    loadingCanvas: () => import('./loadingNetwork.js'),
    particlesLoaderCanvas: () => import('./particlesLoader.js'),
    loadingDnaCanvas: () => import('./loadingDna.js'),
    loadingHexCanvas: () => import('./loadingHexGrid.js'),
    loadingEqualizerCanvas: () => import('./loadingEqualizer.js'),
    loadingSphereCanvas: () => import('./loadingSphere.js'),
    transitionParticlesCanvas: () => import('./transitionParticles.js'),
    transitionMorphCanvas: () => import('./transitionMorphPage.js'),
    transitionFlipCanvas: () => import('./transitionFlipBook.js'),
    portfolioLogoCanvas: () => import('./portfolioLogo.js'),
};

const loadedModules = new Map();
const hiddenTimeouts = new Map();

// Improved visibility observer for pause/resume + auto dispose
const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const id = entry.target.id;
        const visible = entry.isIntersecting;

        if (visible && animations[id] && !loadedModules.has(id)) {
            // Lazy load & init
            animations[id]().then((module) => {
                if (module.init) {
                    module.init(entry.target);
                    loadedModules.set(id, module);
                }
            }).catch(err => console.error(`Failed to load ${id}:`, err));
        } else if (loadedModules.has(id)) {
            const module = loadedModules.get(id);
            if (visible) {
                // Resume and clear dispose timeout
                module.resume?.();
                const timeoutId = hiddenTimeouts.get(id);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    hiddenTimeouts.delete(id);
                }
            } else {
                // Pause and schedule dispose after 5s hidden.
                // Important: only delete the module if it implements dispose;
                // otherwise we would re-init later and duplicate UI controls.
                module.pause?.();
                if (!hiddenTimeouts.has(id)) {
                    hiddenTimeouts.set(id, setTimeout(() => {
                        if (loadedModules.has(id)) {
                            if (module.dispose) {
                                module.dispose();
                                loadedModules.delete(id);
                                // console.log(`Disposed ${id} after idle`);
                            }
                        }
                        hiddenTimeouts.delete(id);
                    }, 5000));
                }
            }
        }
    });
}, {
    // On charge uniquement quand au moins 25% du canvas est visible
    threshold: 0.25,
    // On évite de pré-charger trop loin : pas de marge haute, on ne préload pas sous le pli
    rootMargin: '0px 0px -50% 0px'
});

// Resize handler for all canvases
window.addEventListener('resize', () => {
    document.querySelectorAll('canvas').forEach(canvas => {
        canvas.dispatchEvent(new CustomEvent('resize'));
    });
});

// Global fullscreen change handler
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.style.overflow = 'auto';
    } else {
        document.body.style.overflow = 'hidden';
    }
});

// Met en pause tout quand l'onglet est masqué, reprend au retour
document.addEventListener('visibilitychange', () => {
    const paused = document.visibilityState !== 'visible';
    loadedModules.forEach((module) => {
        if (paused) module.pause?.();
        else module.resume?.();
    });
});


Object.keys(animations).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Le logo portfolio doit s'afficher dès l'arrivée sur la page.
    // On l'initialise immédiatement plutôt que d'attendre l'IntersectionObserver
    // (évite les cas où l'observer ne déclenche pas parce que le canvas est déjà visible à 0px du viewport).
    if (id === 'portfolioLogoCanvas') {
        animations[id]().then((module) => {
            if (module.init) {
                module.init(el);
                loadedModules.set(id, module);
            }
        }).catch(err => console.error(`Failed to load ${id}:`, err));
        return;
    }

    visibilityObserver.observe(el);
});
