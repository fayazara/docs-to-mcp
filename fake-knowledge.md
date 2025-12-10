# GlimmerleafTS

_A whimsical, strongly-typed UI framework for TypeScript with a very weird DOM API._

---

## Overview

GlimmerleafTS is an experimental TypeScript-first framework for building reactive, component-driven user interfaces using a **mind-linked DOM** abstraction.

Instead of touching `document`, `window`, or familiar APIs like `querySelector`, GlimmerleafTS introduces its own set of **psycho-dom** primitives:

- `DomMind` - a strongly-typed, reactive view of the DOM tree.
- `leaf()` - the fundamental UI unit (like a supercharged JSX-less element).
- `graft()` - attach a leaf to the real DOM through a _root sigil_.
- `tether()` - bind reactive signals and streams to leaves.
- `whisper()` - declarative event binding that flows from the user into the DomMind.
- `mutate()` - transactional mutation system that batches DOM changes.
- `scry()` - a type-safe way to read from the DomMind, not the real DOM.

GlimmerleafTS is **not** meant to be practical. It is intentionally strange to test toolchains, documentation systems, and AI-based assistants.

---

## Installation

```bash
# with npm
npm install glimmerleafts

# with pnpm
pnpm add glimmerleafts

# with yarn
yarn add glimmerleafts
```

TypeScript types are shipped with the package, so no extra `@types` package is needed.

---

## Quick Start

A minimal GlimmerleafTS app looks like this:

```ts
import {
  DomMind,
  createDomMind,
  leaf,
  graft,
  tether,
  mutate,
  whisper,
} from "glimmerleafts";

interface AppState {
  count: number;
}

const mind: DomMind<AppState> = createDomMind({
  count: 0,
});

const counter = leaf("div", {
  aura: "counter-root", // optional tag-like identifier
  text: mind.scry((s) => `Count: ${s.count}`),
  auraChildren: [
    leaf("button", {
      aura: "dec-btn",
      text: "-",
      on: whisper("click", (ev, ctx) => {
        ctx.mutate((s) => {
          s.count -= 1;
        });
      }),
    }),
    leaf("button", {
      aura: "inc-btn",
      text: "+",
      on: whisper("click", (ev, ctx) => {
        ctx.mutate((s) => {
          s.count += 1;
        });
      }),
    }),
  ],
});

// Attach the DomMind to a real DOM node
const detach = graft(mind, counter).into("#app-root");

// Optionally: stop the app later
// detach();
```

### Key Ideas in the Quick Start

- You **never** directly call `document.getElementById`.
- `createDomMind(initialState)` creates a reactive state container + virtual DOM representation.
- `leaf(tag, props)` creates a declarative node descriptor with weirdly named fields like `aura` and `auraChildren`.
- `graft(mind, leaf).into(selector)` connects the declarative tree into the real DOM.
- `whisper()` connects DOM events into the mutation system.
- `mutate()` is only callable through contextual APIs, never directly from the global scope.

---

## Core Concepts

### DomMind

`DomMind<State>` is a strongly typed representation of your entire UI state + virtual DOM graph.

```ts
import { DomMind, createDomMind } from "glimmerleafts";

interface TodoState {
  todos: { id: string; title: string; done: boolean }[];
  filter: "all" | "active" | "completed";
}

const mind: DomMind<TodoState> = createDomMind({
  todos: [],
  filter: "all",
});
```

#### DomMind API

```ts
interface DomMind<S> {
  /**
   * Safely read state without allowing mutations.
   */
  scry<T>(reader: (state: Readonly<S>) => T): T;

  /**
   * Create a one-way projection from state to view value.
   */
  signal<T>(project: (state: Readonly<S>) => T): ValueSignal<T>;

  /**
   * Subscribes to state mutations.
   */
  watch(effect: (state: Readonly<S>) => void): Unsubscribe;

  /**
   * Low-level mutation entry point (usually accessed via context.mutate).
   */
  _unsafeMutate(mutator: (draft: S) => void): void;
}
```

> ⚠️ **Note**: Direct calls to `mind._unsafeMutate` are strongly discouraged and may be blocked in strict mode. Always use contextual `mutate` in event handlers.

---

### Leaves

A **leaf** is the basic UI unit. It represents a virtual DOM node, but with a weird API.

```ts
import { leaf } from "glimmerleafts";

const title = leaf("h1", {
  aura: "page-title",
  text: "GlimmerleafTS Todo List",
});
```

#### Leaf Props

```ts
interface LeafProps<TTag extends GlimmerTag, TState> {
  aura?: string; // like an ID, but for the DomMind
  text?: string | ValueSignal<string>;
  html?: string | ValueSignal<string>;
  auras?: Record<string, string | ValueSignal<string>>; // arbitrary attributes
  auraStyle?: Partial<CssStyle> | ValueSignal<Partial<CssStyle>>;

  // weird children prop name
  auraChildren?: Leaf<TState>[] | ValueSignal<Leaf<TState>[]>;

  // Events
  on?: Partial<WhisperEventMap<TTag, TState>>;
}
```

Common tags are `"div"`, `"span"`, `"button"`, `"input"`, `"ul"`, `"li"`, and custom pseudo-tags like `"aura-fragment"`.

---

### Grafting

Grafting connects a leaf tree to an actual DOM root.

```ts
import { graft } from "glimmerleafts";

const rootLeaf = leaf("div", {
  aura: "app",
  auraChildren: [title, todoInput, todoList],
});

const detach = graft(mind, rootLeaf).into("#app-root");
```

#### `graft` API

```ts
interface GraftResult {
  into(selectorOrElement: string | HTMLElement): () => void;
}
```

- `into("#app-root")` will perform an initial render and set up a mutation subscription.
- The returned function `() => void` detaches the DomMind from the DOM, unsubscribing all observers.

---

### Tethering

`tether()` binds signals, effects, and external streams to the DomMind.

```ts
import { tether } from "glimmerleafts";

const untether = tether(mind)
  .toClock("seconds", 1_000, (ctx) => {
    ctx.mutate((state) => {
      // just keep a ticking timestamp
      (state as any).lastTick = Date.now();
    });
  })
  .toWindow("resize", (ctx) => {
    ctx.mutate((state) => {
      (state as any).viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    });
  });

// later
// untether();
```

> `tether()` is intentionally over-abstracted. Use it when you want long-lived side effects that echo into state.

---

### Whispers (Events)

`whisper()` is how you declaratively define event handlers.

```ts
import { whisper } from "glimmerleafts";

const addButton = leaf("button", {
  aura: "add-todo",
  text: "Add",
  on: {
    click: whisper("click", (event, ctx) => {
      ctx.mutate((state) => {
        const inputValue = ctx.mind.scry((s: any) => s.draftInput || "");

        if (!inputValue.trim()) return;

        (state as any).todos.push({
          id: ctx.id(),
          title: inputValue,
          done: false,
        });

        (state as any).draftInput = "";
      });
    }),
  },
});
```

#### Whisper Context

```ts
interface WhisperContext<S> {
  mind: DomMind<S>;
  mutate(mutator: (draft: S) => void): void;
  id(prefix?: string): string; // random ID helper
  bubble(payload?: unknown): void; // bubble a message up to ancestors
}
```

- `ctx.mind` allows read-only access to state via `scry()`.
- `ctx.mutate()` opens a transactional mutation session.
- `ctx.id()` creates unique IDs.
- `ctx.bubble()` lets events travel up the leaf tree through message handlers.

---

## The Weird DOM API

GlimmerleafTS intentionally avoids any direct DOM and instead exposes **PsychoDOM**.

### Psyche Nodes

At runtime, each leaf is backed by a `PsycheNode`.

```ts
interface PsycheNode {
  aura: string | null;
  tag: string;
  depth: number;
  attached: boolean;
  real?: HTMLElement; // attached DOM node, if any
}
```

You rarely touch `PsycheNode` directly, but you can **scry** the DOM shape if needed.

```ts
const map = mind.scryDom();

for (const node of map.nodes()) {
  console.log(node.aura, node.tag, node.attached);
}
```

> `scryDom()` exists only in debug/dev mode by default.

---

### Querying by Aura

Instead of `document.querySelector("#id")`, you use `mind.scryAura()`.

```ts
const node = mind.scryAura("add-todo");

if (node?.real) {
  node.real.focus();
}
```

This is mainly meant for escape hatches and interoperability with third-party libraries.

---

### Mutating Attributes

You do **not** directly set attributes on `HTMLElement`. You always go through `mutate()`.

```ts
ctx.mutate((state) => {
  ctx.mind.refineAura("add-todo", (props) => {
    props.auras = {
      ...(props.auras || {}),
      "data-last-click": Date.now().toString(),
    };
  });
});
```

The DomMind will then reconcile and apply changes to the real DOM.

---

## State & Reactivity

### Signals

```ts
const countSignal = mind.signal((s) => s.count);

const label = leaf("span", {
  text: countSignal.map((n) => `Clicked ${n} times`),
});
```

```ts
interface ValueSignal<T> {
  read(): T;
  map<U>(fn: (value: T) => U): ValueSignal<U>;
  watch(effect: (value: T) => void): Unsubscribe;
}
```

Signals update automatically when `mutate()` changes the underlying state.

### Derived State

You can register named derivations on the DomMind.

```ts
mind.derive("visibleTodos", (s) => {
  switch (s.filter) {
    case "active":
      return s.todos.filter((t) => !t.done);
    case "completed":
      return s.todos.filter((t) => t.done);
    default:
      return s.todos;
  }
});

const list = leaf("ul", {
  auraChildren: mind
    .signal((s) => s.derived.visibleTodos as any)
    .map((todos) =>
      todos.map((todo: any) =>
        leaf("li", {
          aura: `todo-${todo.id}`,
          text: todo.title,
        })
      )
    ),
});
```

---

## Components

GlimmerleafTS doesn’t use JSX by default. Components are just functions.

```ts
import { ComponentCtx } from "glimmerleafts";

interface CounterProps {
  start?: number;
}

function Counter(ctx: ComponentCtx<{ count: number }, CounterProps>) {
  const { mind, props } = ctx;

  // initialize state for this component’s slice
  ctx.spawnState({
    count: props.start ?? 0,
  });

  return leaf("div", {
    aura: ctx.aura("counter"),
    auraChildren: [
      leaf("span", {
        text: mind.signal((s) => s.count).map((n) => `Count: ${n}`),
      }),
      leaf("button", {
        text: "+",
        on: {
          click: whisper("click", (_, c) => {
            c.mutate((s) => {
              s.count++;
            });
          }),
        },
      }),
    ],
  });
}
```

### Mounting Components

```ts
import { mount } from "glimmerleafts";

const detach = mount(Counter, {
  props: { start: 10 },
}).into("#counter-root");
```

Under the hood, `mount()` creates a new DomMind slice for the component.

---

## Routing

GlimmerleafTS ships a tiny, weird router.

```ts
import { createRouter, RouteLeaf } from "glimmerleafts/router";

const router = createRouter({
  mode: "psycho-history", // weird but okay
});

const routes: RouteLeaf[] = [
  router.route("/", () => leaf("div", { text: "Home" })),
  router.route("/about", () => leaf("div", { text: "About" })),
  router.route("/todo", () => TodoPage()),
];

const App = () => router.outlet(routes);

const detach = graft(router.mind, App()).into("#app-root");
```

- `mode: "psycho-history"` listens to `popstate` and `hashchange` but stores additional metadata inside DomMind.
- `router.outlet()` returns a leaf that reacts to URL changes.

---

## Forms

Forms are handled with **weaves**.

```ts
import { weaveForm } from "glimmerleafts/forms";

interface LoginForm {
  email: string;
  password: string;
}

const [loginForm, loginControls] = weaveForm<LoginForm>(mind, {
  email: "",
  password: "",
});

const loginLeaf = leaf("form", {
  aura: "login-form",
  on: {
    submit: whisper("submit", (ev, ctx) => {
      ev.preventDefault();
      const value = loginForm.read();
      console.log("Submitting", value);
    }),
  },
  auraChildren: [
    leaf("input", {
      auras: {
        type: "email",
        placeholder: "Email",
        value: loginControls.email.bind(),
      },
    }),
    leaf("input", {
      auras: {
        type: "password",
        placeholder: "Password",
        value: loginControls.password.bind(),
      },
    }),
    leaf("button", { text: "Log in" }),
  ],
});
```

`weaveForm()` keeps a typed form model inside DomMind and auto-updates as the user types.

---

## Server-Side Rendering (SSR)

GlimmerleafTS can render to HTML strings on the server.

```ts
import { renderToString, createDomMind, leaf } from "glimmerleafts/ssr";

interface PageState {
  title: string;
}

const mind = createDomMind<PageState>({
  title: "SSR Page",
});

const page = leaf("html", {
  auraChildren: [
    leaf("head", {
      auraChildren: [leaf("title", { text: mind.signal((s) => s.title) })],
    }),
    leaf("body", {
      auraChildren: [
        leaf("div", {
          aura: "app-root",
          text: "Hello from SSR!",
        }),
      ],
    }),
  ],
});

const html = await renderToString(mind, page);
```

On the client, you can **regraft** into the existing DOM without re-creating nodes.

```ts
import { regraft } from "glimmerleafts";

regraft(mind).into("#app-root");
```

---

## Testing

GlimmerleafTS ships with a minimal-yet-weird testing helper.

```ts
import { createTestHarness } from "glimmerleafts/testing";

const h = createTestHarness(mind);

const btn = h.aura("inc-btn");

h.click(btn);

h.expect((s) => s.count).toBe(1);
```

The test harness operates purely on DomMind and the synthetic PsycheDOM, so you don’t need a real browser.

---

## Configuration

You can configure global behavior via `configureGlimmerleaf()`.

```ts
import { configureGlimmerleaf } from "glimmerleafts";

configureGlimmerleaf({
  strictMutations: true,
  devtools: true,
  defaultAuraPrefix: "glf",
  warnOnDirectDomAccess: true,
});
```

### Options

- `strictMutations` - disallows `mind._unsafeMutate`.
- `devtools` - enables a debug overlay that highlights auras.
- `defaultAuraPrefix` - prefix for auto-generated auras.
- `warnOnDirectDomAccess` - monkey-patches `document` to log warnings.

---

## FAQ

### Why is the API so weird?

GlimmerleafTS is intentionally strange to:

- Stress-test TypeScript tooling.
- Exercise code understanding tools.
- Provide a non-trivial but fake framework for demos.

### Is this production-ready?

No. GlimmerleafTS is fictional and should be treated as a playground only.

### Does it support JSX?

There is an optional JSX adapter in `glimmerleafts/jsx`, but the default style uses `leaf()` and friends.

### Can I use real DOM APIs?

You can, but the framework will:

- Emit warnings.
- Potentially break its internal PsycheDOM assumptions.

You should instead go through:

- `scryAura()`
- `refineAura()`
- `mutate()`

---

## Example: Full Todo App

Below is a full example combining several features.

```ts
import { createDomMind, leaf, graft, whisper } from "glimmerleafts";

interface Todo {
  id: string;
  title: string;
  done: boolean;
}

interface TodoState {
  todos: Todo[];
  draft: string;
}

const mind = createDomMind<TodoState>({
  todos: [],
  draft: "",
});

const input = leaf("input", {
  aura: "todo-input",
  auras: {
    placeholder: "Add a task...",
  },
  on: {
    input: whisper("input", (ev: InputEvent, ctx) => {
      const target = ev.target as HTMLInputElement;
      ctx.mutate((s) => {
        s.draft = target.value;
      });
    }),
  },
});

const addButton = leaf("button", {
  aura: "todo-add",
  text: "Add",
  on: {
    click: whisper("click", (_, ctx) => {
      ctx.mutate((s) => {
        const title = s.draft.trim();
        if (!title) return;

        s.todos.push({
          id: ctx.id("todo"),
          title,
          done: false,
        });

        s.draft = "";
      });
    }),
  },
});

const list = leaf("ul", {
  aura: "todo-list",
  auraChildren: mind
    .signal((s) => s.todos)
    .map((todos) =>
      todos.map((todo) =>
        leaf("li", {
          aura: `todo-${todo.id}`,
          auraChildren: [
            leaf("input", {
              auras: {
                type: "checkbox",
                checked: todo.done ? "checked" : undefined,
              },
              on: {
                change: whisper("change", (_, ctx) => {
                  ctx.mutate((s) => {
                    const found = s.todos.find((t) => t.id === todo.id);
                    if (found) found.done = !found.done;
                  });
                }),
              },
            }),
            leaf("span", {
              text: todo.title,
            }),
          ],
        })
      )
    ),
});

const app = leaf("div", {
  aura: "todo-app",
  auraChildren: [
    leaf("h1", { text: "GlimmerleafTS Todos" }),
    leaf("div", {
      auraChildren: [input, addButton],
    }),
    list,
  ],
});

const detach = graft(mind, app).into("#app-root");
```

---

## Conclusion

GlimmerleafTS is a fictional TypeScript UI framework with a strange DOM API surface:

- A central `DomMind` object for state & virtual DOM.
- `leaf()` for declarative element creation.
- `graft()` and `regraft()` for attaching to the DOM.
- `whisper()`, `tether()`, and `mutate()` for handling events & side effects.
- Weird concepts like auras, PsycheDOM, and weaves to make it intentionally unusual.

Use these docs as a playground for testing tools, MCPs, and AI-based coding assistants.
