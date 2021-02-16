import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { Geoptic } from "./geoptic.js/build/geoptic.module.min.js";
// import { Geoptic } from "./geoptic.js/src/geoptic.js";

import { bunny } from "./disk-bunny.js";

import {
  Vector,
  Mesh,
  MeshIO,
  Geometry,
  indexElements,
  DenseMatrix,
  memoryManager,
  SpectralConformalParameterization,
  HeatMethod,
} from "./geometry-processing-js/build/geometry-processing.module.min.js";

let mesh = undefined;
let geo = undefined;
let sources = [];
let sourceIndices = [];

let gpMesh = undefined;
let gpSources = undefined;

let hm = undefined; // HeatMethod object, stores Laplacian factorization

// create geoptic manager
let geoptic = new Geoptic({ parent: document.getElementById("geoptic-panel") });

function initMesh(meshFile) {
  let soup = MeshIO.readOBJ(meshFile);

  gpMesh = geoptic.registerSurfaceMesh("bunny", soup.v, soup.f);

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
  const fn = [];
  for (let iV = 0; iV < 500; iV++) {
    const x = Math.random(-1, 1);
    const y = Math.random(-1, 1);
    const z = Math.random(-1, 1);
    vertices.push([x, y, z]);
    fn.push(Math.random(-1, 1));
  }
  const pc = geoptic.registerPointCloud("Random Points", vertices);
  pc.addScalarQuantity("fn", fn);
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

// Add button to perform Spectral Conformal Parameterization
geoptic.commandGuiFields["SCP"] = function () {
  geoptic.slowFunction(() => {
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
    if (hm) {
      memoryManager.deleteExcept([hm.A, hm.F]);
    } else {
      memoryManager.deleteExcept([]);
    }
    console.timeEnd("collect garbage");
  });
};

geoptic.commandGui
  .add(geoptic.commandGuiFields, "SCP")
  .name("Parameterize (SCP)");

// Add folder for Head Method
let heatFolder = geoptic.commandGui.addFolder(
  "Geodesic Distance (Heat Method)"
);
// Add Checkbox to toggle "Source Placement Mode"
geoptic.commandGuiFields["Sources"] = false;
heatFolder.add(geoptic.commandGuiFields, "Sources").name("Place Sources");
heatFolder.open();
function heatMethod() {
  console.time("construct HeatMethod");
  if (!hm || hm.geometry != geo) {
    memoryManager.deleteExcept([]);
    hm = new HeatMethod(geo);
  }
  console.timeEnd("construct HeatMethod");
  const N = gpMesh.nV;
  const sources = DenseMatrix.zeros(N, 1);
  sourceIndices.forEach((iV) => {
    sources.set(1, iV, 0);
  });
  console.time("run HeatMethod");
  const distance = hm.compute(sources);
  console.timeEnd("run HeatMethod");

  let dVec = [];
  for (let iV = 0; iV < N; iV++) {
    dVec[iV] = distance.get(iV, 0);
  }

  console.time("geoptic");
  let q = gpMesh.addVertexDistanceQuantity("Distance from Sources", dVec);
  q.setEnabled(true);
  console.timeEnd("geoptic");

  memoryManager.deleteExcept([hm.A, hm.F]);
}

geoptic.userCallback = () => {};

// Load the bunny mesh
initMesh(bunny);

function addHeatMethodSource(iV) {
  const pos = gpMesh.coords[iV];
  sources.push(gpMesh.coords[iV]);
  gpSources = geoptic.registerPointCloud("Heat Method Sources", sources);
  // Add a callback to the heat method sources to remove them
  gpSources.vertexPickCallback = (iV) => {
    if (geoptic.commandGuiFields["Sources"]) {
      removeHeatMethodSource(iV);
    }
  };
  geoptic.slowFunction(() => {
    sourceIndices.push(iV);
    heatMethod();
  });
}
function removeHeatMethodSource(iV) {
  console.log("remove");
  sources.splice(iV, 1);
  sourceIndices.splice(iV, 1);
  gpSources = geoptic.registerPointCloud("Heat Method Sources", sources);
  // Add a callback to the heat method sources to remove them
  gpSources.vertexPickCallback = (iV) => {
    if (geoptic.commandGuiFields["Sources"]) {
      removeHeatMethodSource(iV);
    }
  };
  if (!sourceIndices.empty) {
    geoptic.slowFunction(() => {
      heatMethod();
    });
  }
}

// Add a callback to allow source placement
gpMesh.vertexPickCallback = (iV) => {
  if (geoptic.commandGuiFields["Sources"]) {
    addHeatMethodSource(iV);
  }
};
gpMesh.edgePickCallback = (iE) => {
  if (geoptic.commandGuiFields["Sources"]) {
    addHeatMethodSource(gpMesh.edges[iE][0]);
  }
};
gpMesh.facePickCallback = (iF) => {
  if (geoptic.commandGuiFields["Sources"]) {
    addHeatMethodSource(gpMesh.faces[iF][0]);
  }
};

initCurveNetwork();

initPointCloud();

geoptic.doneLoading();
geoptic.message("Done loading");

// Load the meshes and set up our state
// walkMesh(bunny);

// Start animating with geoptic
// This will call geoptic.userCallback() every frame
geoptic.animate();
