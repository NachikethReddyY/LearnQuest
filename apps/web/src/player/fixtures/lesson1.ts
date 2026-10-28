import type { StepInput } from "@learnquest/player-core";

// Synthetic lesson (ours, MIT). Each step's beforeFiles is the previous step's result.
const CART = "src/cart.js";
const TEST = "src/cart.test.js";

const cart1 = `export function addItem(cart, item) {
  return [...cart, item];
}
`;
const cart2 = `export function addItem(cart, item) {
  return [...cart, item];
}

export function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price, 0);
}
`;
const cart3 = `export function addItem(cart, item) {
  return [...cart, item];
}

export function cartTotal(cart, discount = 0) {
  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
  return subtotal * (1 - discount);
}
`;
const test1 = `import { cartTotal } from "./cart.js";

console.assert(cartTotal([]) === 0);
`;

const steps: { id: string; title: string; summary: string; input: StepInput }[] = [
  {
    id: "s1",
    title: "Add a cartTotal function",
    summary: "Write cartTotal(cart), which adds up the price of every item in the cart. Notice how reduce starts from 0 so an empty cart totals 0.",
    input: {
      beforeFiles: { [CART]: cart1, [TEST]: test1 },
      hunks: [
        {
          id: "h1",
          file: CART,
          oldStart: 3,
          lines: [
            " }",
            "+",
            "+export function cartTotal(cart) {",
            "+  return cart.reduce((sum, item) => sum + item.price, 0);",
            "+}",
          ],
        },
      ],
    },
  },
  {
    id: "s2",
    title: "Support a discount",
    summary: "Give cartTotal an optional discount between 0 and 1. Watch how the subtotal is computed first, then scaled by (1 - discount).",
    input: {
      beforeFiles: { [CART]: cart2, [TEST]: test1 },
      hunks: [
        {
          id: "h2",
          file: CART,
          oldStart: 5,
          lines: [
            "-export function cartTotal(cart) {",
            "-  return cart.reduce((sum, item) => sum + item.price, 0);",
            "+export function cartTotal(cart, discount = 0) {",
            "+  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);",
            "+  return subtotal * (1 - discount);",
            " }",
          ],
        },
      ],
    },
  },
  {
    id: "s3",
    title: "Test the total and the discount",
    summary: "Add console.assert checks for a plain total and for a 50% discount, so the behaviour from the last two steps is pinned down.",
    input: {
      beforeFiles: { [CART]: cart3, [TEST]: test1 },
      hunks: [
        {
          id: "h3",
          file: TEST,
          oldStart: 3,
          lines: [
            " console.assert(cartTotal([]) === 0);",
            "+",
            "+const items = [{ price: 10 }, { price: 5 }];",
            "+console.assert(cartTotal(items) === 15);",
            "+console.assert(cartTotal(items, 0.5) === 7.5);",
          ],
        },
      ],
    },
  },
];

export default {
  id: "lesson-1",
  title: "Build a shopping cart total",
  mode: "video" as "video" | "task",
  steps: steps.map((s, idx) => ({ ...s, idx })),
};
