// Section 4: add.getAll live on ObjectsAPI (packages/api/src/impl/objects.ts).
// Physical-correspondence classification (Digital Object / Shadow / Twin) is
// not a field on SceneObject yet — see the TARGET block in the guide.
import { scene } from "./section-3-core";

const lampPost = scene.objects.add({
  name: "Lamp Post 12",
  type: "model",
  url: "/models/lamp-post.glb",
  position: [23.7275, 37.9838, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  interactable: true,
  visible: true,
});

const all = scene.objects.getAll();

export { lampPost, all };
