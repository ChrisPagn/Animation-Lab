import * as THREE from 'three';

export function init() {

    // animation de fond : cube tournant
    (function () {

        const canvas = document.getElementById("cubeCanvasThree");

        // Sécurité
        if (!canvas) {
            console.error("Canvas cubeCanvas introuvable");
            return;
        }

        const scene  = new THREE.Scene();

        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });

        // Taille FIXE (important pour commencer)
        const width = canvas.width;
        const height = canvas.height;

        renderer.setSize(width, height, false);

        const camera = new THREE.PerspectiveCamera(
            75,
            width / height,
            0.1,
            1000
        );

        camera.position.z = 5;

        // Cube
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(geometry, material);

        scene.add(cube);

        function animate() {
            requestAnimationFrame(animate);

            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;

            renderer.render(scene, camera);
        }

        animate();

        // Resize (maintenant CORRECT)
        window.addEventListener('resize', () => {
            const width = canvas.clientWidth || canvas.width;
            const height = canvas.clientHeight || canvas.height;

            renderer.setSize(width, height, false);

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });

    })();
}