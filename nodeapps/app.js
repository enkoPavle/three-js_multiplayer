const express = require("express");
const app = express();
const http = require("http").Server(app);
const CANNON = require("cannon-es");
const THREE = require("three");
const crypto = require("crypto");
const io = require("socket.io")(http);
const Control = require("./userControl.js");
app.use(express.static("../public_html/ballsandboxes/"));
app.use(express.static("../public_html/libs"));

app.use(cors({
  origin: '*'
}));

// -------------------------Cannon-----------------------

const objectsToUpdate = [];
const sceneObjects = {
  static: [],
  dynamic: [],
};

const addSceneObject = function (
  worldType,
  id,
  name,
  gType,
  gParam,
  mType,
  mParam,
  param
) {
  const cryptoId = crypto.randomBytes(16).toString("hex");
  if (worldType === "static") {
    const newStaticObject = {
      cryptoId,
      name,
      geometry: {
        type: gType,
        param: gParam,
      },
      material: {
        type: mType,
        param: mParam,
      },
      param,
    };

    sceneObjects.static.push(newStaticObject);
  }

  if (worldType === "dynamic") {
    const newDynamicObject = {
      id: id ? id : cryptoId,
      name,
      geometry: {
        type: gType,
        param: gParam,
      },
      material: {
        type: mType,
        param: mParam,
      },
      param,
    };
    sceneObjects.dynamic.push(newDynamicObject);
  }
};

const world = new CANNON.World();
world.broadphase = new CANNON.SAPBroadphase(world);
// world.allowSleep = true;
world.gravity.set(0, -9.8, 0);

// Default material
const defaultMaterial = new CANNON.Material("default");
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.5,
    restitution: 0.7,
  }
);
world.defaultContactMaterial = defaultContactMaterial;

addSceneObject(
  "static",
  null,
  "floor",
  "PlaneGeometry",
  [200, 200],
  "MeshStandardMaterial",
  { color: "green" },
  {
    receiveShadow: true,
    rotation: {
      x: -Math.PI * 0.5,
    },
  }
);

// Floor
const floorShape = new CANNON.Plane();
const floorBody = new CANNON.Body();
floorBody.mass = 0;
floorBody.addShape(floorShape);
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
world.addBody(floorBody);

// Fence
const mainFencePos = [
  { x: 50, y: 2, z: 0 },
  { x: 0, y: 2, z: -50 },
  { x: -50, y: 2, z: 0 },
  { x: 0, y: 2, z: 50 },
];

for (let i = 0; i < 4; i++) {
  const mainFenceShape = new CANNON.Box(new CANNON.Vec3(50, 2, 0.1));
  const mainFenceBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(
      mainFencePos[i].x,
      mainFencePos[i].y,
      mainFencePos[i].z
    ),
    shape: mainFenceShape,
    material: defaultMaterial,
  });
  if (i === 0 || i === 2)
    mainFenceBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, -1, 0),
      Math.PI * 0.5
    );

  addSceneObject(
    "static",
    null,
    `main fence ${i}`,
    "BoxBufferGeometry",
    [100, 4, 0.2],
    "MeshStandardMaterial",
    {
      color: "brown",
    },
    {
      position: mainFencePos[i],
      ...(i === 0 && {
        rotation: { y: -Math.PI * 0.5 },
      }),
      ...(i === 2 && {
        rotation: { y: -Math.PI * 0.5 },
      }),
    }
  );

  world.addBody(mainFenceBody);
}

// Inner fence

const innerFenceShape = new CANNON.Box(new CANNON.Vec3(22.2, 2, 0.1));
const innerFenceBody1 = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(-27, 2, 0),
  shape: innerFenceShape,
  material: defaultMaterial,
});
const innerFenceBody2 = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(27, 2, 0),
  shape: innerFenceShape,
  material: defaultMaterial,
});

world.addBody(innerFenceBody1);
world.addBody(innerFenceBody2);

addSceneObject(
  "static",
  null,
  "innerFence1",
  "BoxBufferGeometry",
  [45, 4, 0.2],
  "MeshStandardMaterial",
  { color: "brown" },
  { position: { x: -27, y: 2, z: 0 } }
);

addSceneObject(
  "static",
  null,
  "innerFence1",
  "BoxBufferGeometry",
  [45, 4, 0.2],
  "MeshStandardMaterial",
  { color: "brown" },
  { position: { x: 27, y: 2, z: 0 } }
);
//

// Inner Fence Goal

// Windmill

// Boxes

const boxShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));

for (let i = 0; i < 15; i++) {
  const id = crypto.randomBytes(16).toString("hex");

  const boxBody = new CANNON.Body({
    mass: 1 * i + 1,
    position: new CANNON.Vec3(-30 + 5 * i, 2, -25),
    shape: boxShape,
    material: defaultMaterial,
  });

  world.addBody(boxBody);

  addSceneObject(
    "dynamic",
    id,
    `box ${i + 1}`,
    "BoxBufferGeometry",
    [2, 2, 2],
    "MeshStandardMaterial",
    { color: "pink" },
    { position: { x: -30 + 5 * i, y: 2, z: -25 } }
  );

  objectsToUpdate.push({ id, body: boxBody, control: null });
}

// Balls

const ballShape = new CANNON.Sphere(1);

for (let i = 0; i < 15; i++) {
  const id = crypto.randomBytes(16).toString("hex");

  const ballBody = new CANNON.Body({
    mass: 1 * i + 1,
    position: new CANNON.Vec3(-30 + 5 * i, 2, 25),
    shape: ballShape,
    material: defaultMaterial,
  });

  world.addBody(ballBody);

  addSceneObject(
    "dynamic",
    id,
    `ball ${i + 1}`,
    "SphereGeometry",
    [1, 20, 20],
    "MeshStandardMaterial",
    { color: "pink" },
    { position: { x: -30 + 5 * i, y: 2, z: 25 } }
  );

  objectsToUpdate.push({ id, body: ballBody, control: null });
}

//----------Create user----------^

const userShape = new CANNON.Sphere(1);

const createUser = (id) => {
  const userBody = new CANNON.Body({
    mass: 20,
    position: new CANNON.Vec3(0, 10, 0),
    shape: userShape,
    material: defaultMaterial,
    linearDamping: 0.4,
    angularDamping: 0.9,
  });

  world.addBody(userBody);

  objectsToUpdate.push({ id, body: userBody, control: new Control(userBody) });

  addSceneObject(
    "dynamic",
    id,
    "user",
    "SphereGeometry",
    [1, 20, 20],
    "MeshStandardMaterial",
    {
      metalness: 0.3,
      roughness: 0.4,
      color: "red",
    },
    {
      castShadow: true,
      position: { x: 0, y: 10, z: 0 },
    }
  );
};

const removeUser = (id) => {
  const objectsToUpdateIndex = objectsToUpdate.findIndex((x) => x.id === id);
  const sceneObjectsIndex = sceneObjects.dynamic.findIndex((x) => x.id === id);

  if (objectsToUpdateIndex !== -1) {
    world.removeBody(objectsToUpdate[objectsToUpdateIndex].body);
    objectsToUpdate.splice(objectsToUpdateIndex, 1);
  }
  if (sceneObjectsIndex !== -1) {
    sceneObjects.dynamic.splice(sceneObjectsIndex, 1);
  }
};

//--------------------------------------------------

objectsToUpdate.forEach((object) => {
  if (object.control !== null) {
    return;
  }
  object.body.addEventListener("collide", (collision) => {
    const impactStrength = collision.contact.getImpactVelocityAlongNormal();
    if (impactStrength > 5) {
      io.emit("collide", object.id);
    }
  });
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "../public_html/ballsandboxes/index.html");
});

app.get("/scene-objects", function (req, res) {
  res.send(sceneObjects);
});

let numbers = 0;
io.on("connection", (socket) => {
  const userId = crypto.randomBytes(16).toString("hex");
  io.sockets.connected[socket.id].emit("getId", userId);
  console.log("a user connected with " + userId + " id");
  socket.on("disconnect", () => {
    console.log("user disconnected with " + userId + " id");
    removeUser(userId);
    io.sockets.emit("remove-user-mesh", userId);
  });
  socket.on("create-user", (id) => {
    createUser(id);
    io.sockets.emit(
      "new-user-mesh",
      sceneObjects.dynamic[sceneObjects.dynamic.length - 1]
    );
  });
  socket.on("onKeyPress", (data) => {
    const userIndex = objectsToUpdate.findIndex((x) => x.id === data.id);
    if (userIndex !== -1)
      objectsToUpdate[userIndex].control.onKeyPress({
        type: data.type,
        code: data.code,
      });
  });
  socket.on("onMouseMove", (data) => {
    const userIndex = objectsToUpdate.findIndex((x) => x.id === data.id);
    if (userIndex !== -1)
      objectsToUpdate[userIndex].control.onMouseMove(data.movementX);
  });
});

http.listen(3000, function () {
  console.log("listening on *:3000");
});

const tick = 20;
const clock = new THREE.Clock();
let oldElapsedTime = 0;

setInterval(function () {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  let objectsMeshArray = [];

  if (objectsToUpdate.length) {
    for (const object of objectsToUpdate) {
      if (object.control !== null) {
        object.control.update(deltaTime);
      }
    }
  }

  world.step(1 / 60, tick, 3);

  if (objectsToUpdate.length) {
    for (const object of objectsToUpdate) {
      let objectMesh = {};
      if (object.control !== null) {
        objectMesh = {
          id: object.id,
          position: object.body.position,
          quaternion: object.body.quaternion,
          cameraRotation: object.control.getCameraRotation(),
        };
      } else {
        objectMesh = {
          id: object.id,
          position: object.body.position,
          quaternion: object.body.quaternion,
        };
      }
      objectsMeshArray.push(objectMesh);
    }

    io.emit("remoteData", objectsMeshArray);
  }
}, tick);
