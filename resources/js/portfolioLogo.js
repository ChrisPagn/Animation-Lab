import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function init(canvasParam) {
    let canvas = canvasParam || document.getElementById('portfolioLogoCanvas');
    if (!canvas) return console.error('No canvas for portfolioLogo');

    // Clear existing controls if the module is re‑initialised
    let controlsContainer = document.getElementById('logoControls');
    if (controlsContainer) controlsContainer.remove();

    const rect = canvas.getBoundingClientRect();
    const W = canvas.clientWidth || rect.width;
    const H = canvas.clientHeight || rect.height;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.025);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(W, H);
    renderer.setClearColor(0x020208);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Bloom adouci pour garder le texte lisible
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.2, 0.85));

    // THREE.Timer n'est pas exposé dans certaines versions; Clock suffit pour delta time
    const clock = new THREE.Clock();
    let rafId = null;
    let isPaused = false;
    let elapsed = 0;
    let morphProgress = 0;
    let waveTime = 0;
    let isAssembled = false;

    function pause() {
        isPaused = true;
    }

    function resume() {
        isPaused = false;
        if (fontLoaded) rafId = requestAnimationFrame(animate);
    }

    function dispose() {
        if (rafId) cancelAnimationFrame(rafId);
        composer.dispose();
        renderer.dispose();
        if (particleGeo) particleGeo.dispose();
        if (particleMat) particleMat.dispose();
        if (textGeo) textGeo.dispose();
        if (controlsContainer) controlsContainer.remove();
        window.removeEventListener('resize', resizeHandler);
        if (canvas) canvas.removeEventListener('resize', resizeHandler);
        scene.clear();
        canvas = null;
    }

    let fontLoaded = false;
    let particleGeo, particleMat, particles, currPos, originalPos, count, textGeo;

    const fontLoader = new FontLoader();
    fontLoader.load(
        'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
        (font) => {
            const textConfig = {
                font,
                size: 1.4,
                height: 0.15,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.03,
                bevelSize: 0.03,
                bevelSegments: 6
            };

            textGeo = new TextGeometry('ANIMATIONS LAB', textConfig);
            textGeo.computeBoundingBox();
            textGeo.center();

            count = textGeo.attributes.position.count;
            const positions = new Float32Array(count * 3);
            textGeo.attributes.position.array.forEach((v, i) => positions[i] = v);

            originalPos = positions.slice();

            particleGeo = new THREE.BufferGeometry();
            particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            particleMat = new THREE.PointsMaterial({
                size: 0.14,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.9,
                color: 0x66ccff,
                blending: THREE.NormalBlending,
                depthWrite: false
            });

            particles = new THREE.Points(particleGeo, particleMat);
            scene.add(particles);

            // Random init
            currPos = particleGeo.attributes.position.array;
            for (let i = 0; i < count * 3; i += 3) {
                currPos[i]     = (Math.random() - 0.5) * 15;
                currPos[i + 1] = (Math.random() - 0.5) * 15;
                currPos[i + 2] = (Math.random() - 0.5) * 15;
            }
            particleGeo.attributes.position.needsUpdate = true;

            fontLoaded = true;
            if (!isPaused) rafId = requestAnimationFrame(animate);
        },
        undefined,
        () => {
            // Fallback cube particles
            console.warn('Font load failed, fallback cube');
            const fallbackGeo = new THREE.BoxGeometry(4, 0.5, 0.2, 20, 8, 8);
            const positions = fallbackGeo.attributes.position.array.slice();
            fallbackGeo.dispose();
            // ... similar setup
            fontLoaded = true;
            rafId = requestAnimationFrame(animate);
        }
    );

    function animate() {
        if (isPaused || !fontLoaded) return rafId = requestAnimationFrame(animate);

        const delta = clock.getDelta();
        elapsed += delta;
        waveTime += delta;

        if (!isAssembled) {
            morphProgress += delta * 1.2;
            if (morphProgress >= 1) {
                morphProgress = 1;
                isAssembled = true;
            }

            for (let i = 0; i < count * 3; i++) {
                currPos[i] = THREE.MathUtils.lerp(currPos[i], originalPos[i], delta * 4);
            }
        } else {
            for (let i = 0; i < count; i++) {
                const idx = i * 3;
                // Oscillation plus douce pour préserver la lisibilité des lettres
                currPos[idx + 1] += Math.sin(waveTime * 2 + originalPos[idx] * 0.02) * 0.008;
                currPos[idx + 2] += Math.sin(waveTime * 1.8 + originalPos[idx + 1] * 0.03) * 0.006;
            }
        }

        particleGeo.attributes.position.needsUpdate = true;

        particles.rotation.y += delta * 0.3;

        const camTime = elapsed * 0.3;
        camera.position.x = Math.cos(camTime) * 6;
        camera.position.y = Math.sin(camTime * 0.7) * 2;
        camera.position.z = Math.sin(camTime * 0.5) * 6 + 5;
        camera.lookAt(0, 0, 0);

        // Taille stabilisée et couleur fixe pour des contours nets
        particleMat.size = 0.14;
        particleMat.color.set(0x66ccff);

        composer.render();
        rafId = requestAnimationFrame(animate);
    }

    // Resize
    const resizeHandler = () => {
        if (!canvas) return;
        const w = canvas.clientWidth || canvas.width;
        const h = canvas.clientHeight || canvas.height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
    };
    window.addEventListener('resize', resizeHandler);
    canvas.addEventListener('resize', resizeHandler);

    // Controls
    const controlsHTML = `
        <div id="logoControls" style="display:flex;gap:12px;align-items:center;margin:1rem 0;background:rgba(2,2,8,0.9);padding:12px 20px;border-radius:25px;font-family:sans-serif;justify-content:center;flex-wrap:wrap;">
            <label style="color:#44ddff;font-size:13px;">Vitesse</label>
            <input type="range" id="logoSpeed" min="0.2" max="2" value="1" step="0.1" style="width:100px;accent-color:#44ddff;">
            <button id="logoReset" style="color:#fff;background:rgba(68,221,255,0.3);border:1px solid rgba(68,221,255,0.6);padding:6px 16px;border-radius:20px;cursor:pointer;font-size:12px;">⟳ Reset</button>
        </div>
    `;
    canvas.insertAdjacentHTML('afterend', controlsHTML);
    controlsContainer = document.getElementById('logoControls');

    const speedSlider = document.getElementById('logoSpeed');
    const resetBtn = document.getElementById('logoReset');
    speedSlider.addEventListener('input', (e) => {
        const factor = parseFloat(e.target.value);
        particleMat.size = 0.12 * factor;
    });
    resetBtn.addEventListener('click', () => {
        morphProgress = 0;
        isAssembled = false;
        for (let i = 0; i < count * 3; i += 3) {
            currPos[i] = (Math.random() - 0.5) * 15;
            currPos[i + 1] = (Math.random() - 0.5) * 15;
            currPos[i + 2] = (Math.random() - 0.5) * 15;
        }
        particleGeo.attributes.position.needsUpdate = true;
    });

    return { pause, resume, dispose };
}
