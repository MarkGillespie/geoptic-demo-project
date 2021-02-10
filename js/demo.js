import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { Geoptic } from "./geoptic.js/geoptic.js";

let mesh = undefined;
let geo = undefined;
let gpMesh = undefined;

// create geoptic manager
let geoptic = new Geoptic();

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

geoptic.commandGuiFields["K"] = function () {
  let curvatures = [];
  for (let v of mesh.vertices) {
    let iV = v.index;
    curvatures[iV] = geo.scalarGaussCurvature(v);
  }
  let q = gpMesh.addVertexScalarQuantity("K", curvatures);
  q.setEnabled(true);
  q.dataMin = -Math.PI / 16;
  q.dataMax = Math.PI / 16;
};
geoptic.commandGui
  .add(geoptic.commandGuiFields, "K")
  .name("Compute Gauss Curvature");

geoptic.commandGuiFields["L"] = function () {
  let vertexIndices = indexElements(geo.mesh.vertices);
  let L = geo.laplaceMatrix(vertexIndices);
  let M = geo.massMatrix(vertexIndices);

  let N = L.nRows();
  let llt = L.chol();
  let ones = DenseMatrix.ones(N, 1);
  let x = DenseMatrix.random(N, 1);
  for (let i = 0; i < 50; i++) {
    x = llt.solvePositiveDefinite(M.timesDense(x));
    x.scaleBy(1 / x.norm(2));
  }
  let eVec = [];
  for (let v of geo.mesh.vertices) {
    let iV = vertexIndices[v];
    eVec[iV] = x.get(iV, 0);
  }

  let q = gpMesh.addVertexScalarQuantity("L eigenvector 0", eVec);
  q.setEnabled(true);
};
geoptic.commandGui
  .add(geoptic.commandGuiFields, "L")
  .name("Laplacian Eigenvector");

geoptic.userCallback = () => {};

// Initialize geoptic
geoptic.init();

initMesh(bunny);

geoptic.doneLoading();

// Load the meshes and set up our state
// walkMesh(bunny);

// Start animating with geoptic
// This will call geoptic.userCallback() every frame
geoptic.animate();
