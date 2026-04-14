import * as THREE from 'three';

export function init() {

    (function initLoadingNetwork() {
        const canvas = document.getElementById("loadingCanvas");
        if (!canvas) {
            console.warn("⏳ loadingCanvas non trouvé → loader ignoré");
            return;
        }


        const W = canvas.width;
        const H = canvas.height;

        // ─────────────────────────────
        // SCÈNE
        // ─────────────────────────────
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // Ajustement de la caméra pour capturer toute la scène
        const camera = new THREE.PerspectiveCamera(75, W / H, 1, 2000);
        camera.position.z = 400;  // Position plus éloignée pour capturer toute la scène

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(window.devicePixelRatio);

        // ─────────────────────────────
        // PARTICULES
        // ─────────────────────────────
        const MAX_COUNT = 80;  // Augmentation du nombre de particules
        let activeCount = 10;  // Nombre initial de particules actives

        const positions = new Float32Array(MAX_COUNT * 3);
        const velocities = new Float32Array(MAX_COUNT * 3);

        // Répartition initiale sur une plus grande zone
        for (let i = 0; i < MAX_COUNT; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 400;  // x
            positions[i * 3 + 1] = (Math.random() - 0.5) * 400;  // y
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;  // z

            velocities[i * 3]     = (Math.random() - 0.5) * 1.5;  // Vitesse x
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 1.5;  // Vitesse y
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.0;  // Vitesse z
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x00ff00,  // Vert vif
            size: 3,          // Taille légèrement augmentée
            transparent: true,
            opacity: 0
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // ─────────────────────────────
        // LIGNES
        // ─────────────────────────────
        const maxDistance = 150;  // Augmentation de la distance maximale pour les lignes
        let lineGeometry = new THREE.BufferGeometry();

        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00aaff,  // Bleu clair
            transparent: true,
            opacity: 0
        });

        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        scene.add(lines);

        // ─────────────────────────────
        // MISE À JOUR DES LIGNES
        // ─────────────────────────────
        function updateLines() {
            const pos = geometry.attributes.position.array;
            let vertices = [];

            for (let i = 0; i < activeCount; i++) {
                for (let j = i + 1; j < activeCount; j++) {
                    const dx = pos[i * 3] - pos[j * 3];
                    const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
                    const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    // Seuil de distance pour tracer une ligne
                    if (dist < maxDistance && dist > 30) {
                        vertices.push(
                            pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2],
                            pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]
                        );
                    }
                }
            }

            lineGeometry.dispose();
            lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            lines.geometry = lineGeometry;
        }

        // ─────────────────────────────
        // ANIMATION
        // ─────────────────────────────
        let progress = 0;

        function animate() {
            requestAnimationFrame(animate);
            progress += 0.015;  // Augmentation de la vitesse de progression

            const pos = geometry.attributes.position.array;

            // Ajout progressif de particules
            if (activeCount < MAX_COUNT && Math.random() < 0.2) {
                activeCount += 2;  // Ajout de 2 particules à la fois pour accélérer le remplissage
            }

            for (let i = 0; i < activeCount; i++) {
                // Expansion progressive
                pos[i * 3]     += velocities[i * 3];
                pos[i * 3 + 1] += velocities[i * 3 + 1];
                pos[i * 3 + 2] += velocities[i * 3 + 2];

                // Ralentissement pour un effet organique
                velocities[i * 3]     *= 0.98;
                velocities[i * 3 + 1] *= 0.98;
                velocities[i * 3 + 2] *= 0.98;

                // Oscillation légère
                pos[i * 3]     += Math.sin(progress + i) * 0.5;
                pos[i * 3 + 1] += Math.cos(progress + i) * 0.5;
            }

            geometry.attributes.position.needsUpdate = true;

            // Opacité progressive
            material.opacity = Math.min(progress, 1);
            lineMaterial.opacity = Math.min(progress - 0.2, 0.8);

            updateLines();
            renderer.render(scene, camera);
        }

        animate();
    })();
}