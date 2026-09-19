// React Three Fiber & Three.js JSX type declarations
// These enable TSX syntax for 3D elements without full R3F types

declare namespace JSX {
  interface IntrinsicElements {
    group: any;
    mesh: any;
    sphereGeometry: any;
    meshStandardMaterial: any;
    line: any;
    bufferGeometry: any;
    float32BufferAttribute: any;
    lineBasicMaterial: any;
    ambientLight: any;
    directionalLight: any;
    OrbitControls: any;
    Canvas: any;
    Html: any;
    Text: any;
  }
}
