const CANNON = require("cannon-es");
const THREE = require("three");

class Control {
  constructor(userBody) {
    this.CANNON = CANNON;

    this.enabled = false;

    this.userBody = userBody;
    this.pitchObject = new THREE.Object3D();
    this.yawObject = new THREE.Object3D();
    this.pitchObject.position.setX(this.userBody.position.x);
    this.pitchObject.position.setY(this.userBody.position.y);
    this.pitchObject.position.setZ(this.userBody.position.z);
    this.yawObject.add(this.pitchObject);
    this.quaternion = new THREE.Quaternion();

    this.Jump = false;
    this.isGrounded = false;
    this.canJump = false;
    this.acceleration = 1;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.pitchSpeed = 0;
    this.rollSpeed = 0;
    this.yawSpeed = 0;
    this.rotation = 0;
    this.yawObject;

    this.velocityFactor = 0.15;
    this.jumpVelocity = 10;
    this.velocity = this.userBody.velocity;

    const contactNormal = new CANNON.Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    const upAxis = new CANNON.Vec3(0, 1, 0);
    this.userBody.addEventListener("collide", (event) => {
      const { contact } = event;

      // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
      // We do not yet know which one is which! Let's check.
      if (contact.bi.id === this.userBody.id) {
        // bi is the player body, flip the contact normal
        contact.ni.negate(contactNormal);
      } else {
        // bi is something else. Keep the normal as it is
        contactNormal.copy(contact.ni);
      }

      // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
      if (contactNormal.dot(upAxis) > 0.15) {
        // Use a "good" threshold value between 0 and 1 here!
        this.canJump = true;
      }
    });

    this.inputVelocity = new THREE.Vector3();
    this.euler = new THREE.Euler();

    this.init();
  }

  init() {
    this.enabled = true;
  }

  onKeyPress(data) {
    if (!this.enabled) return;
    if (data.type === "Down") {
      switch (data.code) {
        case "ShiftLeft":
        case "ShiftRight":
          this.acceleration = 3;
          break;

        case "KeyW":
        case "ArrowUp":
          if (this.canJump) {
            this.moveForward = true;
          }
          break;

        case "KeyA":
        case "ArrowLeft":
          if (this.canJump) {
            this.moveLeft = true;
          }
          break;

        case "KeyS":
        case "ArrowDown":
          if (this.canJump) {
            this.moveBackward = true;
          }
          break;

        case "KeyD":
        case "ArrowRight":
          if (this.canJump) {
            this.moveRight = true;
          }
          break;

        case "Space":
          if (this.canJump) {
            this.velocity.y = this.jumpVelocity;
          }
          this.canJump = false;
          break;
      }
    }

    if (data.type === "Up") {
      switch (data.code) {
        case "ShiftLeft":
        case "ShiftRight":
          this.acceleration = 1;
          break;

        case "KeyW":
        case "ArrowUp":
          this.moveForward = false;
          break;

        case "KeyA":
        case "ArrowLeft":
          this.moveLeft = false;
          break;
        case "KeyQ":
          this.moveLeft = false;
          break;

        case "KeyS":
        case "ArrowDown":
          this.moveBackward = false;
          break;

        case "KeyD":
        case "ArrowRight":
          this.moveRight = false;
          break;
        case "KeyE":
          this.moveRight = false;
          break;
      }
    }
  }

  getCameraRotation() {
    return this.yawObject.rotation.y;
  }

  onMouseMove(movementX) {
    if (!this.enabled) {
      return;
    }
    this.yawObject.rotation.y -= movementX * 0.008;
  }

  update(delta) {
    if (this.enabled === false) {
      return;
    }
    delta *= 1000;
    delta *= 0.1;

    this.inputVelocity.set(0, 0, 0);

    if (this.moveForward) {
      this.inputVelocity.z = -this.velocityFactor * delta * this.acceleration;
    }
    if (this.moveBackward) {
      this.inputVelocity.z = this.velocityFactor * delta * this.acceleration;
    }

    if (this.moveLeft) {
      this.inputVelocity.x = -this.velocityFactor * delta;
    }
    if (this.moveRight) {
      this.inputVelocity.x = this.velocityFactor * delta;
    }

    // Convert velocity to world coordinates
    this.euler.x = this.pitchObject.rotation.x;
    this.euler.y = this.yawObject.rotation.y;
    this.euler.order = "XYZ";
    this.quaternion.setFromEuler(this.euler);
    this.inputVelocity.applyQuaternion(this.quaternion);

    // Add to the object
    this.velocity.x += this.inputVelocity.x;
    this.velocity.z += this.inputVelocity.z;
    this.yawObject.position.copy(this.userBody.position);
  }
}

module.exports = Control;
