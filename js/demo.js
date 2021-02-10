import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { Geoptic } from "./geoptic.js/geoptic.js";

function vertexCoordinates(mesh) {
  let positions = new Float32Array(V * 3);
  for (let v of mesh.vertices) {
    let i = v.index;

    let position = geometry.positions[v];
    positions[3 * i + 0] = position.x;
    positions[3 * i + 1] = position.y;
    positions[3 * i + 2] = position.z;
  }

  return {
    positions: positions,
    get: function (i) {
      return new THREE.Vector3(
        this.positions[3 * i + 0],
        this.positions[3 * i + 1],
        this.positions[3 * i + 2]
      );
    },
  };
}

// TODO: support non-triangle meshes
function faceIndices(mesh) {
  let F = mesh.faces.length;
  let indices = new Uint32Array(F * 3);
  for (let f of mesh.faces) {
    let i = 0;
    for (let v of f.adjacentVertices()) {
      indices[3 * f.index + i++] = v.index;
    }
  }
  return {
    positions: positions,
    get: function (i) {
      return new THREE.Vector3(
        this.positions[3 * i + 0],
        this.positions[3 * i + 1],
        this.positions[3 * i + 2]
      );
    },
  };
}

// create geoptic manager
let geoptic = new Geoptic();

function doWork(text) {}

geoptic.userCallback = () => {};

// Once the wasm has loaded, we can start our app
geoptic.message("webassembly loaded");

// Initialize geoptic
geoptic.init();

let bunnySoup = MeshIO.readOBJ(bunny);
let bunnyMesh = new Mesh();
let bunnyGeo;
if (bunnyMesh.build(bunnySoup)) {
  // console.log(bunnyMesh);
  // bunnyGeo = new Geometry(bunnyMesh, bunnySoup["v"]);
  let faces = bunnySoup.f;
  faces.size = function () {
    return faces.length / 3;
  };
  faces.get = function (i) {
    return [faces[3 * i], faces[3 * i + 1], faces[3 * i + 2]];
  };
  geoptic.registerSurfaceMesh("bunny", bunnySoup.v, faces);
} else {
  geoptic.warning("unable to build halfedge mesh");
}

geoptic.doneLoading();

// Load the meshes and set up our state
// walkMesh(bunny);

// Start animating with geoptic
// This will call geoptic.userCallback() every frame
geoptic.animate();
