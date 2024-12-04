// Sahne, Kamera ve Renderer ayarları
const canvas = document.getElementById('background-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Sahne oluşturuluyor
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Arka plan rengi siyah

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1, 2.4);

// Işık ekleme (ışık şiddetini artırdık)
const light = new THREE.DirectionalLight(0xffffff, 2); // Işık şiddetini artırdık
light.position.set(1, 1, 2).normalize();
scene.add(light);

// Neon SpotLight eklemek
const spotlight = new THREE.SpotLight(0xffffff, 3, 100, Math.PI / 4, 0.5, 2); // Işık şiddeti artırıldı
spotlight.position.set(5, 10, 5);
spotlight.target.position.set(0, -5, 0);
scene.add(spotlight.target);
spotlight.castShadow = true;
scene.add(spotlight);

// Arka plan gradient oluşturma
const gradientMaterial = new THREE.ShaderMaterial({
  uniforms: {
    color1: { value: new THREE.Color(0x000000) }, // Siyah
    color2: { value: new THREE.Color(0x2e2e2e) }, // Koyu gri
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform vec3 color1;
    uniform vec3 color2;
    void main() {
      gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
    }
  `,
});
const gradientGeometry = new THREE.PlaneGeometry(2, 2);
const gradientMesh = new THREE.Mesh(gradientGeometry, gradientMaterial);
gradientMesh.position.z = -10;
scene.add(gradientMesh);

// GLTF model yükleme
let mixer;
let loadedModel = null; // Model referansı için bir değişken
const loader = new THREE.GLTFLoader();
loader.load(
  'assets/model.glb',
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(4, 4, 5);
    model.position.set(0, -5, 0);
    scene.add(model);
    loadedModel = model; // Model referansı atanıyor

    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
    }
  },
  undefined,
  (error) => console.error('Model yüklenemedi:', error)
);

// GLTF modelinin dönüşü için ayrı bir saat
const rotationClock = new THREE.Clock();

// Scanlines Shader
const ScanlinesShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0.0 },
    scanlineIntensity: { value: 0.1 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float scanlineIntensity;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float scanline = sin(vUv.y * 800.0 + time * 10.0) * scanlineIntensity;
      color.rgb += vec3(scanline);
      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `,
};

// Effect Composer ayarları
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));

const glitchPass = new THREE.GlitchPass();
glitchPass.goWild = false;
composer.addPass(glitchPass);

const scanlinesPass = new THREE.ShaderPass(ScanlinesShader);
composer.addPass(scanlinesPass);

// Scroll pozisyonu ve hedef rotasyon
let scrollPosition = 0;
let targetRotation = 0;
let currentRotation = 0;

// Scroll dinleyicisi
window.addEventListener('scroll', () => {
  scrollPosition = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
  targetRotation = Math.PI * 2 * scrollPosition;
});

// Renk geçişi ve animasyon değişkenleri
let spotlightTime = 0;
const colors = [
  new THREE.Color(0x8000ff),
  new THREE.Color(0x0000ff),
  new THREE.Color(0xff0000),
  new THREE.Color(0xffffff),
];

let currentColor = new THREE.Color(0x8000ff);
let nextColor = colors[1];
let lerpFactor = 0;

// Animasyon döngüsü
function animate() {
  requestAnimationFrame(animate);
  const delta = rotationClock.getDelta();

  // Animasyon karıştırıcıyı güncelle
  if (mixer) mixer.update(delta);

  // Modelin dönüşünü güncelle
  if (loadedModel) {
    loadedModel.rotation.y -= delta * 0.2; // Saat yönünde yavaş dönüş
  }

  // Shader zamanı güncelle
  scanlinesPass.uniforms.time.value += delta;

  // Spotlight hareketi
  spotlightTime += delta;
  spotlight.position.x = Math.sin(spotlightTime * 2) * 10;
  spotlight.position.z = Math.cos(spotlightTime * 2) * 10;
  spotlight.position.y = Math.abs(Math.sin(spotlightTime * 0.5) * 5 + 5);

  // Renk geçişi
  lerpFactor += delta * 0.5;
  if (lerpFactor >= 1) {
    lerpFactor = 0;
    currentColor = nextColor;
    nextColor = colors[(colors.indexOf(nextColor) + 1) % colors.length];
  }
  spotlight.color.lerpColors(currentColor, nextColor, lerpFactor);

  // Kamera dönüşü
  currentRotation += (targetRotation - currentRotation) * 0.1;
  camera.rotation.y = currentRotation;

  composer.render();
}
animate();

// Pencere boyutlandırma dinleyicisi
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});































// Sayfanın kaydırılabilir olmasını sağla ama scrollbar'ları gizle
document.body.style.overflow = "auto";  // Sayfa kaydırılabilir, scrollbar'lar gizli
document.body.style.overflowX = "hidden";  // Yatay kaydırma gizlensin
document.body.style.overflowY = "scroll"; // Dikey kaydırma aktif kalsın

// WebKit tarayıcılarında (Chrome, Edge, Safari) scrollbar'ı gizle
const style = document.createElement('style');
style.innerHTML = `
  body::-webkit-scrollbar {
    display: none;
  }
`;
document.head.appendChild(style);








// Burger menü fonksiyonu
function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('active');
}

// Müzik kontrol elemanları
const musicIcon = document.getElementById('music-icon');
const backgroundMusic = document.getElementById('background-music');
const volumeControl = document.getElementById('volume-control');
const volumeSlider = document.getElementById('volume-slider');

let isPlaying = false;
let hideTimeout;

// Başlangıç ses düzeyi
backgroundMusic.volume = 0.4;

// Müzik simgesine tıklama
musicIcon.addEventListener('click', () => {
  if (isPlaying) {
    backgroundMusic.pause();
    isPlaying = false;
    hideVolumeControl();
  } else {
    backgroundMusic.play();
    isPlaying = true;
    showVolumeControl();
  }
});

// Ses kontrol kaydırıcısı
volumeSlider.addEventListener('input', (event) => {
  const volume = event.target.value / 100;
  backgroundMusic.volume = volume;
  const percentage = volume * 100;
  volumeSlider.style.background = `linear-gradient(to right, white ${percentage}%, #ccc 0%)`;
});

// Ses kontrolünü göster
function showVolumeControl() {
  if (!isPlaying) return;
  volumeControl.classList.add('show');
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    hideVolumeControl();
  }, 3000);
}

// Ses kontrolünü gizle
function hideVolumeControl() {
  volumeControl.classList.remove('show');
}

// Hover ile ses kontrolünü gösterme
musicIcon.addEventListener('mouseenter', () => {
  if (isPlaying) showVolumeControl();
});
musicIcon.addEventListener('mouseleave', () => {
  hideTimeout = setTimeout(() => {
    hideVolumeControl();
  }, 3000);
});
