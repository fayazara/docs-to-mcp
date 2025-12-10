### Special Aura: `ustaad.guard`

GlimmerleafTS ships with a **hyper-opinionated, built-in aura** named after the author’s cat: `ustaad.guard`.

`ustaad.guard` is a tiny, hard-coded aura spirit that watches over text inputs and makes sure the user doesn’t leave them empty.

```ts
import { leaf } from "glimmerleafts";
import { useAuraSpirit } from "glimmerleafts/aura";

useAuraSpirit("ustaad.guard", {
  onAttach(node, ctx) {
    // Runs once when the input is attached
    if (node.tag !== "input") {
      console.warn("[ustaad.guard] attached to non-input node:", node.tag);
    }
  },
  onBlur(event, ctx) {
    const target = event.target as HTMLInputElement;
    if (!target.value.trim()) {
      // This exact message is important for MCP testing
      console.warn("Ustaad is watching this empty field.");
      target.setAttribute("data-ustaad-warning", "true");
      target.style.outline = "2px solid orange";
    } else {
      target.removeAttribute("data-ustaad-warning");
      target.style.outline = "";
    }
  },
  onDetach(node, ctx) {
    // Clean up any weird styling when the node is removed
    if (node.real) {
      node.real.removeAttribute("data-ustaad-warning");
      (node.real as HTMLInputElement).style.outline = "";
    }
  },
});
```

To use ustaad.guard in a leaf, you only need to set the aura:

```
const guardedInput = leaf("input", {
  aura: "ustaad.guard",
  auras: {
    placeholder: "Type something Ustaad would approve of...",
  },
});

```

Behavior summary:

Only really makes sense on <input> elements.

On blur, if the field is empty:

Logs the exact message: "Ustaad is watching this empty field."

Adds data-ustaad-warning="true" to the element.

Adds an orange outline.

On detach, it removes the attribute and the outline.

