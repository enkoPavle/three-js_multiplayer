class Game {
  constructor() {
    this.menu = document.querySelector(".menu");
    this.canvas = document.querySelector("#canvas");
    this.scene;
    this.camera;
    this.renderer;
    this.sizes;
    this.clock = new THREE.Clock();
    this.oldElapsedTime = 0;

    this.url = "http://localhost:3000/scene-objects";
    this.sceneObjects;
    this.objectsToUpdate = [];
    this.remoteData = [];

    this.playerMesh;
    this.player;
    this.pitchObject = new THREE.Object3D();
    this.startButton = document.querySelector("#button-start");
    this.startButton.addEventListener("click", () => this.startGame());

    this.socket;
    this.id;

    const game = this;

    game.initScene();
  }

  initScene() {
    //----------Scene----------^
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog("#c5e8eb", 0, 200);

    //-----Lights-----^^

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(1024, 1024);
    directionalLight.shadow.camera.far = 15;
    directionalLight.shadow.camera.left = -7;
    directionalLight.shadow.camera.top = 7;
    directionalLight.shadow.camera.right = 7;
    directionalLight.shadow.camera.bottom = -7;
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    //-----Sizes-----^^

    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    window.addEventListener("resize", () => {
      // Update sizes
      this.sizes.width = window.innerWidth;
      this.sizes.height = window.innerHeight;

      // Update camera
      this.camera.aspect = this.sizes.width / this.sizes.height;
      this.camera.updateProjectionMatrix();

      // Update renderer
      this.renderer.setSize(this.sizes.width, this.sizes.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    //-----Camera-----^^
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.sizes.width / this.sizes.height,
      0.1,
      200
    );
    this.camera.position.set(-3, 5, 10);
    this.scene.add(this.camera);

    //----------Renderer----------^

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
    });
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#c5e8eb");

    this.renderer.render(this.scene, this.camera);
  }

  getSceneObjects(url) {
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw Error("could not fetch the data for that resourse");
        }
        return res.json();
      })
      .then((data) => {
        this.sceneObjects = data;
        this.initSceneObjects(this.sceneObjects);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  initSceneObjects(sceneObjects) {
    if (sceneObjects.static.length > 0) {
      for (const object of sceneObjects.static) {
        const geometry = this.getGeometry(
          object.geometry.type,
          object.geometry.param
        );
        const material = this.getMaterial(
          object.material.type,
          object.material.param
        );
        const mesh = new THREE.Mesh(geometry, material);

        for (const key in object.param) {
          if (key === "rotation" || key === "position") {
            for (const subKey in object.param[key]) {
              mesh[key][subKey] = object.param[key][subKey];
            }
          } else {
            mesh[key] = object.param[key];
          }
        }
        this.scene.add(mesh);
      }
    }
    if (sceneObjects.dynamic.length > 0) {
      for (const object of sceneObjects.dynamic) {
        const geometry = this.getGeometry(
          object.geometry.type,
          object.geometry.param
        );
        const material = this.getMaterial(
          object.material.type,
          object.material.param
        );
        const mesh = new THREE.Mesh(geometry, material);

        for (const key in object.param) {
          if (key === "rotation" || key === "position") {
            for (const subKey in object.param[key]) {
              mesh[key][subKey] = object.param[key][subKey];
            }
          } else {
            mesh[key] = object.param[key];
          }
        }
        mesh.name = object.id;
        this.scene.add(mesh);
        this.objectsToUpdate.push({ id: object.id, mesh });
      }
    }

    this.tick();
    this.initSockets();
  }

  initSockets() {
    const game = this;

    this.socket.on("remoteData", function (objectsMeshArray) {
      game.remoteData = objectsMeshArray;

      // Update all users and uncontrolled objects position and quaternion
      for (let i = 0; i < game.remoteData.length; i++) {
        if (game.remoteData[i].id === game.id) {
          game.playerMesh = game.remoteData[i];
          if (game.playerMesh) {
            game.player.position.copy(game.playerMesh.position);
            game.player.quaternion.copy(game.playerMesh.quaternion);

            game.pitchObject.position.copy(game.playerMesh.position);
            game.pitchObject.rotation.y = game.playerMesh.cameraRotation;
          }
        } else {
          if (game.objectsToUpdate.length) {
            const dynamicObject = game.objectsToUpdate.filter(
              (x) => x.id === game.remoteData[i].id
            )[0];
            dynamicObject.mesh.position.copy(game.remoteData[i].position);
            dynamicObject.mesh.quaternion.copy(game.remoteData[i].quaternion);
          }
        }
      }
    });

    this.socket.on("new-user-mesh", function (userMesh) {
      game.createUserMesh(userMesh);
    });

    this.socket.on("remove-user-mesh", function (id) {
      game.removeUserMesh(id);
    });

    this.socket.on("collide", function (id) {
      game.changeColor(id);
    });
  }

  initControll() {
    document.body.requestPointerLock();
    document.addEventListener("pointerlockchange", this.onPointerlockChange);

    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
  }

  onPointerlockChange = () => {
    if (!document.pointerLockElement) {
      window.location.reload();
    }
  };

  reload() {
    setTimeout(() => window.location.reload());
  }

  onMouseMove = (event) => {
    const { movementX } = event;
    game.socket.emit("onMouseMove", { id: game.id, movementX });
  };

  onKeyDown = (event) => {
    const game = this;
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
      case "KeyA":
      case "ArrowLeft":
      case "KeyS":
      case "ArrowDown":
      case "KeyD":
      case "ArrowRight":
      case "ShiftLeft":
      case "ShiftRight":
      case "Space":
        game.socket.emit("onKeyPress", {
          id: game.id,
          type: "Down",
          code: event.code,
        });
        break;
    }
  };

  onKeyUp = (event) => {
    const game = this;
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
      case "KeyA":
      case "ArrowLeft":
      case "KeyS":
      case "ArrowDown":
      case "KeyD":
      case "ArrowRight":
      case "ShiftLeft":
      case "ShiftRight":
      case "Space":
        game.socket.emit("onKeyPress", {
          id: game.id,
          type: "Up",
          code: event.code,
        });
        break;
    }
  };

  tick = () => {
    const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = elapsedTime - this.oldElapsedTime;
    this.oldElapsedTime = elapsedTime;

    // Render
    this.renderer.render(this.scene, this.camera);

    // Call tick again on the next frame
    window.requestAnimationFrame(this.tick);
  };

  startGame() {
    this.menu.style.display = "none";
    this.canvas.style.display = "initial";
    this.getSceneObjects(this.url);
    this.initControll();
    this.socket = window.io();
    const game = this;
    const socket = this.socket;

    socket.on("getId", function (id) {
      game.id = id;
      socket.emit("create-user", id);
    });
  }

  createUserMesh(userMesh) {
    const geometry = this.getGeometry(
      userMesh.geometry.type,
      userMesh.geometry.param
    );
    const material = this.getMaterial(
      userMesh.material.type,
      userMesh.material.param
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = userMesh.id;
    this.pitchObject.add(this.camera);
    this.scene.add(this.pitchObject);

    for (const key in userMesh.param) {
      if (key === "rotation" || key === "position") {
        for (const subKey in userMesh.param[key]) {
          mesh[key][subKey] = userMesh.param[key][subKey];
        }
      } else {
        mesh[key] = userMesh.param[key];
      }
    }
    this.scene.add(mesh);
    if (userMesh.id === this.id) {
      this.player = mesh;
    } else {
      this.objectsToUpdate.push({ id: userMesh.id, mesh });
    }
  }

  removeUserMesh(id) {
    const index = this.objectsToUpdate.findIndex((x) => x.id === id);
    if (index !== -1) {
      this.scene.getObjectByName(id).geometry.dispose();
      this.scene.getObjectByName(id).material.dispose();
      this.scene.remove(this.scene.getObjectByName(id));
      this.objectsToUpdate.splice(index, 1);
    }

    this.renderer.renderLists.dispose();
  }

  getGeometry(type, param) {
    switch (type) {
      case "PlaneGeometry":
        return new THREE.PlaneGeometry(param[0], param[1]);
      case "BoxBufferGeometry":
        return new THREE.BoxBufferGeometry(param[0], param[1], param[2]);
      case "SphereGeometry":
        return new THREE.SphereGeometry(param[0], param[1], param[2]);

      default:
        break;
    }
  }

  getMaterial(type, param) {
    switch (type) {
      case "MeshStandardMaterial":
        return new THREE.MeshStandardMaterial(param);
        break;

      default:
        break;
    }
  }

  changeColor(id) {
    const game = this;
    const index = game.objectsToUpdate.findIndex((x) => x.id === id);

    if (index !== -1) {
      const randomColor = Math.floor(Math.random() * 16777215).toString(16);
      const newMaterial = new THREE.MeshStandardMaterial({
        color: `#${randomColor}`,
      });
      game.objectsToUpdate[index].mesh.material = newMaterial;
    }
  }
}
