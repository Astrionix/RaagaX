/**
 * RaagaX Ultra-Smooth Cinematic 3D Splash Engine
 * High-performance, physically believable, GPU-optimized Three.js animation system.
 */
import * as THREE from 'three';
import { Easing, Spring } from './CinematicEasing';
import { AudioEnergyEngine, AudioEnergyState } from './AudioEnergyEngine';

export interface SplashSceneConfig {
  container: HTMLElement;
  onComplete?: () => void;
  reducedMotion?: boolean;
}

export class RaagaXSplashScene {
  private container: HTMLElement;
  private onComplete?: () => void;
  private reducedMotion: boolean;

  // Three.js Core
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Spring Physics Controllers
  private logoScaleSpring = new Spring(0.72, 110, 15);
  private logoRotYSpring = new Spring(-0.35, 95, 14);
  private logoPosYSpring = new Spring(0.42, 100, 16);
  private cameraZSpring = new Spring(8.0, 70, 18);

  // 3D Objects & Materials
  private logoGroup: THREE.Group | null = null;
  private logoMaterial: THREE.MeshPhysicalMaterial | null = null;
  private backplateMaterial: THREE.MeshPhysicalMaterial | null = null;

  private energyRings: THREE.Mesh[] = [];
  private particlePoints: THREE.Points | null = null;
  private particleGeo: THREE.BufferGeometry | null = null;
  private particlePositions: Float32Array | null = null;
  private particleVelocities: Float32Array | null = null;
  private particleCount = 1800;

  private waveformBars: THREE.Mesh[] = [];
  private waveformGroup: THREE.Group | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private terrainGeo: THREE.PlaneGeometry | null = null;

  // Lights
  private redKeyLight: THREE.PointLight | null = null;
  private redRimLight: THREE.PointLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;

  // State & Timing
  private elapsedTime = 0;
  private isDestroyed = false;
  private mouseX = 0;
  private mouseY = 0;
  private targetCamX = 0;
  private targetCamY = 0.2;

  constructor(config: SplashSceneConfig) {
    this.container = config.container;
    this.onComplete = config.onComplete;
    this.reducedMotion = config.reducedMotion ?? false;

    this.configureQualityProfile();
    this.init();
  }

  private configureQualityProfile() {
    const isMobile = typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (this.reducedMotion) {
      this.particleCount = 200;
    } else if (isMobile) {
      this.particleCount = 700;
    } else {
      this.particleCount = 1800;
    }
  }

  private init() {
    if (typeof window === 'undefined') return;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040508);
    this.scene.fog = new THREE.FogExp2(0x040508, 0.11);

    // 2. Camera Setup (starts at cinematic distance Z = 8.0)
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    this.camera.position.set(0, 0.2, 8.0);

    // 3. WebGLRenderer with Color Management
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.reducedMotion,
        alpha: false,
        powerPreference: 'high-performance',
      });
      const maxDpr = this.reducedMotion ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.setPixelRatio(maxDpr);
      this.renderer.setSize(width, height);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn('[RaagaXSplash] WebGL initialization error:', e);
      if (this.onComplete) this.onComplete();
      return;
    }

    // 4. Lighting System
    this.setupLighting();

    // 5. Build 3D Entities
    this.createLogoSystem();
    this.createEnergyRings();
    this.createAtmosphericParticles();
    this.createWaveformVisualizer();
    this.createSoundTerrain();

    // 6. Listeners
    this.bindEvents();

    // 7. Start Render Loop
    this.clock.start();
    this.tick();
  }

  private setupLighting() {
    if (!this.scene) return;

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(this.ambientLight);

    // Dynamic red key light
    this.redKeyLight = new THREE.PointLight(0xf20d18, 0, 16, 1.4);
    this.redKeyLight.position.set(0, 1.2, 3.2);
    this.scene.add(this.redKeyLight);

    // Red rim light behind logo
    this.redRimLight = new THREE.PointLight(0xf20d18, 0, 12, 1.6);
    this.redRimLight.position.set(0, 0.4, -1.8);
    this.scene.add(this.redRimLight);

    // Cool subtle top rim light
    const whiteRim = new THREE.DirectionalLight(0xffffff, 0.85);
    whiteRim.position.set(-3.5, 4.5, -2);
    this.scene.add(whiteRim);
  }

  private createLogoSystem() {
    if (!this.scene) return;

    this.logoGroup = new THREE.Group();
    this.logoGroup.position.set(0, 0.42, 0);
    this.logoGroup.scale.set(0.72, 0.72, 0.72);
    this.logoGroup.rotation.y = -0.35;

    // Load High-Res Logo Texture from existing asset
    const textureLoader = new THREE.TextureLoader();
    const logoTex = textureLoader.load('/logo-dark.png');
    logoTex.generateMipmaps = true;
    logoTex.minFilter = THREE.LinearMipmapLinearFilter;

    // Front Emblem Plane with MeshPhysicalMaterial
    const emblemGeo = new THREE.PlaneGeometry(2.0, 2.0);
    this.logoMaterial = new THREE.MeshPhysicalMaterial({
      map: logoTex,
      transparent: true,
      metalness: 0.35,
      roughness: 0.18,
      clearcoat: 0.4,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color(0xf20d18),
      emissiveIntensity: 0.0,
      side: THREE.DoubleSide,
    });
    const emblemMesh = new THREE.Mesh(emblemGeo, this.logoMaterial);
    emblemMesh.position.z = 0.06;
    this.logoGroup.add(emblemMesh);

    // Beveled Backplate for 3D extrusion depth
    const backGeo = new THREE.CylinderGeometry(0.98, 0.98, 0.10, 48);
    backGeo.rotateX(Math.PI / 2);
    this.backplateMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0e1017,
      metalness: 0.85,
      roughness: 0.25,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    const backMesh = new THREE.Mesh(backGeo, this.backplateMaterial);
    backMesh.position.z = -0.01;
    this.logoGroup.add(backMesh);

    this.scene.add(this.logoGroup);
  }

  private createEnergyRings() {
    if (!this.scene) return;

    const ringConfigs = [
      { r: 1.18, w: 0.018, color: 0xf20d18, z: -0.12 },
      { r: 1.44, w: 0.016, color: 0xff2e3b, z: -0.18 },
      { r: 1.76, w: 0.014, color: 0x99000a, z: -0.24 },
    ];

    ringConfigs.forEach((cfg, i) => {
      const geo = new THREE.RingGeometry(cfg.r, cfg.r + cfg.w, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0.35, cfg.z);
      this.energyRings.push(mesh);
      this.scene?.add(mesh);
    });
  }

  private createAtmosphericParticles() {
    if (!this.scene) return;

    this.particleGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      // Spread across volume
      this.particlePositions[i3] = (Math.random() - 0.5) * 14;
      this.particlePositions[i3 + 1] = (Math.random() - 0.5) * 9;
      this.particlePositions[i3 + 2] = (Math.random() - 0.5) * 9;

      this.particleVelocities[i3] = (Math.random() - 0.5) * 0.008;
      this.particleVelocities[i3 + 1] = Math.random() * 0.012 + 0.003;
      this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.008;
    }

    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xf20d18,
      size: 0.042,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particlePoints = new THREE.Points(this.particleGeo, particleMat);
    this.scene.add(this.particlePoints);
  }

  private createWaveformVisualizer() {
    if (!this.scene) return;

    this.waveformGroup = new THREE.Group();
    this.waveformGroup.position.set(0, -1.65, 0);

    const barCount = 37;
    const barWidth = 0.055;
    const barSpacing = 0.105;
    const totalWidth = barCount * barSpacing;

    const baseBoxGeo = new THREE.BoxGeometry(barWidth, 1, 0.055);

    for (let i = 0; i < barCount; i++) {
      const barMat = new THREE.MeshPhysicalMaterial({
        color: 0xf20d18,
        emissive: new THREE.Color(0xf20d18),
        emissiveIntensity: 0.0,
        roughness: 0.25,
        metalness: 0.45,
        clearcoat: 0.5,
      });

      const barMesh = new THREE.Mesh(baseBoxGeo, barMat);
      const posX = (i * barSpacing) - (totalWidth / 2);
      barMesh.position.set(posX, 0, 0);
      barMesh.scale.set(1, 0.04, 1);

      this.waveformBars.push(barMesh);
      this.waveformGroup.add(barMesh);
    }

    this.scene.add(this.waveformGroup);
  }

  private createSoundTerrain() {
    if (!this.scene) return;

    this.terrainGeo = new THREE.PlaneGeometry(16, 12, 38, 28);
    this.terrainGeo.rotateX(-Math.PI / 2.2);

    const terrainMat = new THREE.MeshBasicMaterial({
      color: 0x1f0609,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeo, terrainMat);
    this.terrainMesh.position.set(0, -2.15, -1);
    this.scene.add(this.terrainMesh);
  }

  private bindEvents() {
    const isMobile = typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile && !this.reducedMotion) {
      window.addEventListener('mousemove', this.onMouseMove);
    }

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onMouseMove = (e: MouseEvent) => {
    this.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    this.mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    this.targetCamX = this.mouseX * 0.25;
    this.targetCamY = 0.2 + (this.mouseY * 0.12);
  };

  private onResize = () => {
    if (!this.camera || !this.renderer || !this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    } else {
      if (this.animationFrameId === null && !this.isDestroyed) {
        this.clock.start();
        this.tick();
      }
    }
  };

  private tick = () => {
    if (this.isDestroyed) return;

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.05); // Clamp to prevent jump after freeze
    this.elapsedTime += delta;

    // 1. Audio Energy Engine
    const audioState = AudioEnergyEngine.getInstance().update(this.elapsedTime, delta);

    // 2. Coordinated Systems Update
    this.updateTimeline(this.elapsedTime, delta, audioState);
    this.updateParticles(delta, audioState);
    this.updateWaveform(this.elapsedTime, audioState);
    this.updateTerrain(this.elapsedTime, audioState);
    this.updateCamera(delta);

    // 3. Render Pass
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    // 4. Progress loop
    if (this.elapsedTime < 3.4) {
      this.animationFrameId = requestAnimationFrame(this.tick);
    } else {
      if (this.onComplete) this.onComplete();
    }
  };

  private updateTimeline(t: number, delta: number, audio: AudioEnergyState) {
    // 0.25s: Particles fade in
    if (this.particlePoints) {
      const mat = this.particlePoints.material as THREE.PointsMaterial;
      if (t >= 0.25 && t < 1.0) {
        mat.opacity = Easing.easeOutCubic((t - 0.25) / 0.75) * 0.85;
      }
    }

    // 0.55s -> 0.90s: Lighting powers up
    if (this.redKeyLight && this.redRimLight) {
      const lightProg = Easing.smoothstep(0.55, 1.2, t);
      const bassPulse = audio.bass * 1.5;
      this.redKeyLight.intensity = (lightProg * 3.5) + bassPulse;
      this.redRimLight.intensity = (lightProg * 2.2) + (bassPulse * 0.8);
    }

    // 0.55s -> 1.30s: Energy Rings expand
    this.energyRings.forEach((ring, idx) => {
      const mat = ring.material as THREE.MeshBasicMaterial;
      const startT = 0.55 + idx * 0.12;
      if (t >= startT) {
        const pulse = 1.0 + Math.sin(t * 3.2 + idx) * 0.04 + (audio.bass * 0.06);
        ring.scale.set(pulse, pulse, pulse);
        ring.rotation.z += 0.006 * (idx % 2 === 0 ? 1 : -1);
        mat.opacity = Easing.smoothstep(startT, startT + 0.6, t) * 0.45;
      }
    });

    // 0.75s -> 1.55s: Logo Physics Spring Settle
    if (this.logoGroup && this.logoMaterial) {
      if (t >= 0.75 && t <= 1.55) {
        this.logoScaleSpring.setTarget(1.0);
        this.logoRotYSpring.setTarget(0.0);
        this.logoPosYSpring.setTarget(0.35);

        this.logoGroup.scale.setScalar(this.logoScaleSpring.update(delta));
        this.logoGroup.rotation.y = this.logoRotYSpring.update(delta);
        this.logoGroup.position.y = this.logoPosYSpring.update(delta);

        this.logoMaterial.emissiveIntensity = Easing.easeOutCubic((t - 0.75) / 0.8) * 0.25;
      } else if (t > 1.55) {
        // Continuous organic breath synchronized with audio energy
        const breath = 1.0 + (Math.sin(t * 1.4) * 0.012) + (audio.energy * 0.02);
        this.logoGroup.scale.setScalar(breath);
        this.logoGroup.rotation.y = Math.sin(t * 0.75) * 0.025;
        this.logoMaterial.emissiveIntensity = 0.2 + (audio.bass * 0.25);
      }
    }

    // 2.90s -> 3.30s: Seamless Dim & Exit Transition
    if (t >= 2.85 && this.container) {
      const exitProgress = Easing.easeInOutCubic((t - 2.85) / 0.45);
      this.container.style.opacity = `${Math.max(0, 1 - exitProgress)}`;
    }
  }

  private updateParticles(delta: number, audio: AudioEnergyState) {
    if (!this.particleGeo || !this.particlePositions || !this.particleVelocities) return;

    const bassPush = audio.beat > 0 ? 0.03 : 0.0;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      this.particlePositions[i3] += this.particleVelocities[i3];
      this.particlePositions[i3 + 1] += this.particleVelocities[i3 + 1] + bassPush;
      this.particlePositions[i3 + 2] += this.particleVelocities[i3 + 2];

      // Respawn boundaries
      if (this.particlePositions[i3 + 1] > 4.5) {
        this.particlePositions[i3 + 1] = -4.5;
        this.particlePositions[i3] = (Math.random() - 0.5) * 14;
      }
    }

    this.particleGeo.attributes.position.needsUpdate = true;
  }

  private updateWaveform(t: number, audio: AudioEnergyState) {
    if (this.waveformBars.length === 0) return;

    const count = this.waveformBars.length;
    for (let i = 0; i < count; i++) {
      const bar = this.waveformBars[i];
      const mat = bar.material as THREE.MeshPhysicalMaterial;

      const distFromCenter = Math.abs(i - (count / 2)) / (count / 2);
      const envelope = Math.max(0.12, 1 - Math.pow(distFromCenter, 1.35));

      // Multi-layer harmonic frequency mix
      const lowFreq = Math.sin(t * 3.6 + i * 0.28) * 0.45 + 0.45;
      const midFreq = Math.sin(t * 6.4 - i * 0.45) * 0.30 + 0.30;
      const highFreq = Math.cos(t * 9.2 + i * 0.75) * 0.25 + 0.25;

      const rawHeight = (lowFreq * 0.5 + midFreq * 0.3 + highFreq * 0.2) * (1 + audio.energy * 1.5);
      const targetHeight = Math.max(0.06, rawHeight * 1.15 * envelope);

      bar.scale.y += (targetHeight - bar.scale.y) * 0.16;
      mat.emissiveIntensity = 0.3 + (bar.scale.y * 0.7) + (audio.bass * 0.3);
    }
  }

  private updateTerrain(t: number, audio: AudioEnergyState) {
    if (!this.terrainGeo) return;

    const pos = this.terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i);
      const dist = Math.sqrt(u * u + v * v);
      const wave = Math.sin(dist * 0.75 - t * 2.2) * (0.10 + audio.bass * 0.08) * Math.exp(-dist * 0.14);
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
  }

  private updateCamera(delta: number) {
    if (!this.camera) return;

    // Cinematic push-in: Z = 8.0 -> 6.8
    this.cameraZSpring.setTarget(6.8);
    this.camera.position.z = this.cameraZSpring.update(delta);

    // Parallax interpolation
    this.camera.position.x += (this.targetCamX - this.camera.position.x) * 0.04;
    this.camera.position.y += (this.targetCamY - this.camera.position.y) * 0.04;
    this.camera.lookAt(0, 0.15, 0);
  }

  public destroy() {
    this.isDestroyed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Systematic WebGL Resource Disposal
    if (this.particleGeo) this.particleGeo.dispose();
    if (this.terrainGeo) this.terrainGeo.dispose();

    if (this.logoMaterial) this.logoMaterial.dispose();
    if (this.backplateMaterial) this.backplateMaterial.dispose();

    this.energyRings.forEach(ring => {
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    });

    this.waveformBars.forEach(bar => {
      bar.geometry.dispose();
      (bar.material as THREE.Material).dispose();
    });

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
  }
}
