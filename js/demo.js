import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { Geoptic } from "./geoptic.js/build/geoptic.module.min.js";
// import { Geoptic } from "./geoptic.js/src/geoptic.js";

import { bunny } from "./disk-bunny.js";

import {
  Mesh,
  MeshIO,
  Geometry,
  indexElements,
  DenseMatrix,
  memoryManager,
  SpectralConformalParameterization,
} from "./geometry-processing-js/build/geometry-processing.module.min.js";

let mesh = undefined;
let geo = undefined;
let gpMesh = undefined;

// create geoptic manager
let geoptic = new Geoptic({ parent: document.getElementById("geoptic-panel") });

function initMesh(meshFile) {
  let soup = MeshIO.readOBJ(meshFile);

  // define size() and get() for geoptic
  let faces = soup.f;
  faces.size = function () {
    return faces.length / 3;
  };
  faces.get = function (i) {
    return [faces[3 * i], faces[3 * i + 1], faces[3 * i + 2]];
  };
  gpMesh = geoptic.registerSurfaceMesh("bunny", soup.v, faces);

  mesh = new Mesh();
  mesh.build(soup);
  geo = new Geometry(mesh, soup.v);
}

function initCurveNetwork() {
  const vertices = [];
  for (let iV = 0; iV < 300; iV++) {
    const x = 1.5 * Math.sin(iV * 0.05);
    const y = 1.5 * Math.cos(iV * 0.05);
    const z = iV * 0.005 + 0.025 * Math.cos(iV * 0.5) - 0.8;
    vertices.push([x, z, y]);
  }
  geoptic.registerCurveNetwork("Helix", vertices);
}

function initPointCloud() {
  const vertices = [];
  for (let iV = 0; iV < 500; iV++) {
    const x = Math.random(-1, 1);
    const y = Math.random(-1, 1);
    const z = Math.random(-1, 1);
    vertices.push([x, y, z]);
  }
  geoptic.registerPointCloud("Random Points", vertices);
}

// Add button to compute gaussian curvature
geoptic.commandGuiFields["K"] = function () {
  let curvatures = [];
  for (let v of mesh.vertices) {
    let iV = v.index;
    curvatures[iV] = geo.scalarGaussCurvature(v);
  }
  let q = gpMesh.addVertexScalarQuantity("K", curvatures);
  q.dataMin = -Math.PI / 16;
  q.dataMax = Math.PI / 16;
  q.setColorMap("coolwarm");
  console.log("coolwarm");
  q.setEnabled(true);
};
geoptic.commandGui
  .add(geoptic.commandGuiFields, "K")
  .name("Compute Gauss Curvature");

// Add button to compute Laplacian eigenvector
geoptic.commandGuiFields["L"] = function () {
  console.time("construction");
  let vertexIndices = indexElements(geo.mesh.vertices);
  let L = geo.laplaceMatrix(vertexIndices);
  let M = geo.massMatrix(vertexIndices);
  console.timeEnd("construction");

  let N = L.nRows();
  console.time("factorization");
  let llt = L.chol();
  let ones = DenseMatrix.ones(N, 1);
  let x = DenseMatrix.random(N, 1);
  x = llt.solvePositiveDefinite(M.timesDense(x));
  console.timeEnd("factorization");

  console.time("power iteration");
  for (let i = 0; i < 50; i++) {
    x = llt.solvePositiveDefinite(M.timesDense(x));
    x.scaleBy(1 / x.norm(2));
  }
  console.timeEnd("power iteration");
  console.time("recording answers");
  let eVec = [];
  for (let v of geo.mesh.vertices) {
    let iV = vertexIndices[v];
    eVec[iV] = x.get(iV, 0);
  }
  console.timeEnd("recording answers");

  console.time("geoptic");
  let q = gpMesh.addVertexScalarQuantity("L eigenvector 0", eVec);
  console.timeEnd("geoptic");
  q.setEnabled(true);
  memoryManager.deleteExcept([]);
};
geoptic.commandGui
  .add(geoptic.commandGuiFields, "L")
  .name("Laplacian Eigenvector");

// Add button to compute Laplacian eigenvector
geoptic.commandGuiFields["SCP"] = function () {
  const scp = new SpectralConformalParameterization(geo);

  console.time("compute flattening");
  const flattening = scp.flatten();
  console.timeEnd("compute flattening");

  console.time("record flattening");
  let fVec = [];
  for (let v of geo.mesh.vertices) {
    let iV = scp.vertexIndex[v];
    fVec[iV] = flattening[v];
  }
  console.timeEnd("record flattening");

  console.time("geoptic");
  let q = gpMesh.addVertexParameterizationQuantity("SCP Texture", fVec);
  q.setEnabled(true);
  console.timeEnd("geoptic");

  console.time("collect garbage");
  memoryManager.deleteExcept([]);
  console.timeEnd("collect garbage");
};

geoptic.commandGui
  .add(geoptic.commandGuiFields, "SCP")
  .name("Parameterize (SCP)");

geoptic.userCallback = () => {};

// Initialize geoptic
geoptic.init();

// Load the bunny mesh
initMesh(bunny);

initCurveNetwork();

initPointCloud();

geoptic.doneLoading();
geoptic.message("Done loading");

// Load the meshes and set up our state
// walkMesh(bunny);

// Start animating with geoptic
// This will call geoptic.userCallback() every frame
geoptic.animate();
