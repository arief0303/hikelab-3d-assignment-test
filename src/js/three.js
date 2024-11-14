import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fragment_basic from '../shaders/fragment_basic.glsl';
import vertex_basic from '../shaders/vertex_basic.glsl';
import * as dat from 'dat.gui';
import {
  CSS2DRenderer,
  CSS2DObject
} from 'three/addons/renderers/CSS2DRenderer.js';

const device = {
  width: window.innerWidth,
  height: window.innerHeight - 1, //-1 to avoid scrollbars
  pixelRatio: window.devicePixelRatio
};

const modelUrl = 'assets/gltf/bunny.gltf';
const albedoMap = new THREE.TextureLoader().load('assets/textures/Albedo.jpg');

export default class Three {
  constructor(canvas) {
    this.canvas = document.querySelector('#canvas');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, 0, 20);

    this.camera = new THREE.PerspectiveCamera(
      75,
      device.width / device.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 4);
    this.camera.rotation.x += 0.001;
    this.camera.rotation.y += 0.001;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.shadowMap.enabled = true; // enable shadows in the renderer
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; // default is false
    this.controls.dampingFactor = 0.025; // This value could be adjusted to your liking
    this.controls.minPolarAngle = 0; // radians
    this.controls.maxPolarAngle = Math.PI / 2; // radians
    this.controls.minDistance = 1; // Minimum distance the camera can zoom in
    this.controls.maxDistance = 2; // Maximum distance the camera can zoom out
    this.controls.enablePan = false; // Disable panning
    this.controls.autoRotate = false;
    this.controls.enableZoom = true;
    this.controls.autoRotate = true;

    let autoRotateTimeout = null;

    // Listen for the start event
    this.controls.addEventListener('start', () => {
      // When the user starts rotating the object, disable auto-rotate
      this.controls.autoRotate = false;
    });

    // Listen for the end event
    this.controls.addEventListener('end', () => {
      // If there's an existing timeout, clear it
      if (autoRotateTimeout) {
        clearTimeout(autoRotateTimeout);
      }

      // When the user stops rotating the object, re-enable auto-rotate after 1 second
      autoRotateTimeout = setTimeout(() => {
        this.controls.autoRotate = true;
      }, 3500);
    });

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setLights();
    this.setGeometry();
    // this.devGUIParams();
    this.render();
    this.raycasterListener();
    this.setResize();
  }

  setLights() {
    const shadowQualityMultiplier = 4;

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1); // white color, full intensity
    this.sunLight.position.set(15, 50, 30);
    this.sunLight.castShadow = true;

    // Increase the shadow map size
    this.sunLight.shadow.mapSize.width = 1024 * shadowQualityMultiplier; // default is 512
    this.sunLight.shadow.mapSize.height = 1024 * shadowQualityMultiplier; // default is 512

    // Adjust the shadow bias and radius (optional)
    this.sunLight.shadow.radius = 30; // Adjust this value as needed

    // Adjust the shadow camera (optional)
    this.sunLight.shadow.camera.near = 0.5; // default
    this.sunLight.shadow.camera.far = 500; // default
    this.scene.add(this.sunLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white light
    this.scene.add(this.ambientLight);
  }

  setGeometry() {
    this.planeGeometry = new THREE.PlaneGeometry(1, 1, 128 / 8, 128 / 8);
    this.planeMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      wireframe: true,
      fragmentShader: fragment_basic,
      vertexShader: vertex_basic,
      uniforms: {
        progress: { type: 'f', value: 0 }
      }
    });
    this.planeMesh = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
    this.planeMesh.position.set(0, 0.5, 2);
    this.planeMesh.castShadow = true;
    // this.scene.add(this.planeMesh);

    this.earthGeometry = new THREE.SphereGeometry(0.75, 128, 128);
    this.earthMaterial = new THREE.MeshStandardMaterial({
      map: albedoMap
    });
    this.earthMesh = new THREE.Mesh(this.earthGeometry, this.earthMaterial);
    this.earthMesh.castShadow = true;
    this.earthMesh.position.set(0, 0, 0);
    this.scene.add(this.earthMesh);

    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.boxMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff });
    this.boxMesh = new THREE.Mesh(this.boxGeometry, this.boxMaterial);
    this.boxMesh.castShadow = true; // enable shadow casting
    this.boxMesh.position.set(-1, 0, 0);
    // this.scene.add(this.boxMesh);

    this.floorGeometry = new THREE.PlaneGeometry(10000, 10000);
    this.floorMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff });
    this.floorMesh = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
    this.floorMesh.receiveShadow = true; // enable shadow receiving
    this.floorMesh.position.y = -1; // Set the plane at the bottom of the scene
    this.floorMesh.rotation.x = -Math.PI / 2; // Rotate the plane to be horizontal
    this.scene.add(this.floorMesh);

    const markerGeometry = new THREE.SphereGeometry(0.02, 30, 30);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    const countries = [
      'Sweden',
      'Netherlands',
      'Belgium',
      'Germany',
      'Austria',
      'Finland',
      'Norway',
      'Denmark',
      'UK'
    ];

    const positions = [
      [0.380149663443285, 0.6385228794229616, -0.10058195022108646],
      [0.45617348073141006, 0.5930106442030869, -0.050987769081875876],
      [0.4857288687189919, 0.5701967661478881, -0.03532143478284532],
      [0.4553364469061161, 0.5882203904432914, -0.09497210927679453],
      [0.4904303035914148, 0.5529520619333614, -0.12681852247793027],
      [0.30555990770545594, 0.6665429313721688, -0.15719577282866856],
      [0.35350183602260454, 0.6590480542759765, -0.05550901885052675],
      [0.41299273882911236, 0.6223106646619474, -0.06739281443235233],
      [0.4539199436982325, 0.5966705143382321, 0.015983415437203885]
    ];

    for (let i = 0; i < countries.length; i++) {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(...positions[i]);

      // Create label
      const labelDiv = document.createElement('div');
      labelDiv.className = 'label';
      labelDiv.textContent = countries[i];
      // labelDiv.style.display = 'none';
      labelDiv.style.visibility = 'hidden';
      // labelDiv.style.zIndex = -1;
      const label = new CSS2DObject(labelDiv);
      label.position.set(0, 0.02, 0);
      marker.add(label);

      marker.addEventListener('click', function () {
        label.element.style.display = 'block';
      });

      // Store label element in user data for easy access
      marker.userData.labelElement = labelDiv;

      this.earthMesh.add(marker);
    }

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    // this.labelRenderer.domElement.style.zIndex = -1;
    document.body.appendChild(this.labelRenderer.domElement);

    window.addEventListener('click', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.raycaster.intersectObjects(
        this.earthMesh.children
      );

      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;

        // Hide all labels
        this.earthMesh.children.forEach((child) => {
          if (child.userData.labelElement && child !== intersectedObject) {
            child.userData.labelElement.style.visibility = 'hidden';
          }
        });

        // Toggle the visibility of the clicked marker's label
        if (intersectedObject.userData.labelElement) {
          intersectedObject.userData.labelElement.style.visibility =
            intersectedObject.userData.labelElement.style.visibility ===
            'visible'
              ? 'hidden'
              : 'visible';
        }
      }
    });

    // Create a white material
    const skyboxMaterial = new THREE.MeshPhysicalMaterial({
      emissive: 0xffffff, // white color
      side: THREE.BackSide, // backside to make it visible from inside the cube
      reflectivity: 0, // no reflectivity
      clearcoat: 0, // no clearcoat
      roughness: 1, // maximum roughness
      metalness: 0 // no metalness
    });
    const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    this.scene.add(skybox);
  }

  devGUIParams() {
    this.gui = new dat.GUI();
    const sunLightFolder = this.gui.addFolder('Sun Light');
    sunLightFolder
      .add(this.sunLight.shadow, 'radius', 0, 100)
      .step(0.1)
      .name('Radius');
    sunLightFolder.open();
    const fogFolder = this.gui.addFolder('Fog');
    fogFolder.add(this.scene.fog, 'far', 5, 250).step(1).name('Far');
    fogFolder.open();
  }

  raycasterListener() {}

  render() {
    const elapsedTime = this.clock.getElapsedTime();

    // this.planeMesh.rotation.x = 0.2 * elapsedTime;
    // this.planeMesh.rotation.y = 0.1 * elapsedTime;

    // Render labels
    this.labelRenderer.render(this.scene, this.camera);

    this.earthMesh.rotation.y = 0.1 * elapsedTime;

    this.controls.update();

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = window.innerWidth;
    device.height = window.innerHeight - 1; //-1 to avoid scrollbars

    this.camera.aspect = device.width / device.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
  }
}
