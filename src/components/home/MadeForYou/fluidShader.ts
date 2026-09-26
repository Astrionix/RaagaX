export const fluidVertexShader = `
  uniform float uTime;
  uniform float uSeed;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uDisplacementScale;
  uniform float uNoiseFrequency;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying float vNoise;

  // ── 3D Simplex Noise Function ──
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + D.xxxx;
    vec4 y = y_ *ns.x + D.xxxx;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  // Multi-octave organic noise displacement calculation
  float getDisplacement(vec3 p) {
    // Liquid breathing time scale (0.08–0.12)
    float t = uTime * 0.12 + uSeed * 10.0;
    vec3 pSample = p * uNoiseFrequency + vec3(t * 0.3, t * 0.2, t * 0.1);

    // Subtle mouse position influence
    vec2 mouseOffset = (uMouse - 0.5) * 0.3 * (1.0 + uHover * 0.5);
    pSample.xy += mouseOffset;

    float octave1 = snoise(pSample);
    float octave2 = snoise(pSample * 2.1 + vec3(1.7, 9.2, 3.4)) * 0.5;
    float octave3 = snoise(pSample * 4.3 + vec3(8.3, 2.8, 5.1)) * 0.25;

    float combined = octave1 + octave2 + octave3;
    float hoverBoost = 1.0 + uHover * 0.25;
    return combined * uDisplacementScale * hoverBoost;
  }

  void main() {
    vec3 pos = position;
    
    // Calculate noise displacement along vertex normal
    float disp = getDisplacement(pos);
    vNoise = disp;

    vec3 displacedPosition = pos + normal * disp;

    // Recalculate normal via finite differences for smooth specular reflections
    float eps = 0.02;
    vec3 tangent1 = normalize(vec3(1.0, 0.0, 0.0));
    vec3 tangent2 = normalize(cross(normal, tangent1));
    tangent1 = normalize(cross(tangent2, normal));

    vec3 p1 = pos + tangent1 * eps;
    vec3 p2 = pos + tangent2 * eps;

    float d1 = getDisplacement(p1);
    float d2 = getDisplacement(p2);

    vec3 displacedP1 = p1 + normal * d1;
    vec3 displacedP2 = p2 + normal * d2;

    vec3 v1 = displacedP1 - displacedPosition;
    vec3 v2 = displacedP2 - displacedPosition;

    vec3 computedNormal = normalize(cross(v1, v2));
    vNormal = normalMatrix * computedNormal;

    vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
    vPosition = displacedPosition;
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const fluidFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  uniform vec3 uColorBg;
  uniform vec3 uRimColor;
  uniform float uRoughness;
  uniform float uMetalness;
  uniform float uHover;
  uniform vec2 uMouse;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying float vNoise;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);

    // Dynamic key light direction (shifts with mouse interaction)
    vec3 lightDir = normalize(vec3(0.5 + (uMouse.x - 0.5) * 0.4, 0.8 + (uMouse.y - 0.5) * 0.4, 1.0));
    vec3 H = normalize(lightDir + V);

    // Multi-color palette blend driven by height noise & surface normal
    float t1 = smoothstep(-0.35, 0.35, vNoise);
    float t2 = smoothstep(0.0, 0.45, vPosition.y + vNoise * 0.5);
    float t3 = smoothstep(-0.2, 0.5, dot(N, vec3(0.0, 1.0, 0.0)));

    vec3 colA = mix(uColor1, uColor2, t1);
    vec3 colB = mix(uColor3, uColor4, t2);
    vec3 baseColor = mix(colA, colB, t3);

    // Deep ambient occlusion in fluid folds
    float ao = smoothstep(-0.4, 0.3, vNoise) * 0.5 + 0.5;
    baseColor *= ao;

    // Diffuse lighting
    float NdotL = max(dot(N, lightDir), 0.0);
    vec3 diffuse = baseColor * (0.35 + 0.65 * NdotL);

    // Glossy liquid specular highlight (Cook-Torrance / Blinn-Phong style)
    float NdotH = max(dot(N, H), 0.0);
    float specPow = mix(32.0, 96.0, 1.0 - uRoughness);
    float spec = pow(NdotH, specPow);
    vec3 specularColor = mix(vec3(1.0), baseColor, uMetalness) * spec * (0.6 + uHover * 0.3);

    // Cinematic Fresnel Rim Lighting (Liquid glass edge highlight)
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    vec3 rim = uRimColor * fresnel * (0.7 + uHover * 0.4);

    // Combine lighting components
    vec3 finalColor = diffuse + specularColor + rim;

    // Soft dark vignette overlay toward screen edges for card depth
    float dist = length(vPosition.xy) * 0.6;
    float vignette = smoothstep(1.3, 0.3, dist);
    finalColor = mix(uColorBg * 0.6, finalColor, vignette);

    // Output vibrant HDR color with soft tone mapping
    finalColor = finalColor / (finalColor + vec3(0.85)); // Reinhard tone mapping
    finalColor = pow(finalColor, vec3(1.0 / 2.2)); // Gamma correction

    gl_FragColor = vec4(finalColor, 0.98);
  }
`;
