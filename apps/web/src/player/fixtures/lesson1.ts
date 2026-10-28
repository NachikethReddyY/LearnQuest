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

const steps: { id: string; title: string; input: StepInput }[] = [
  {
    id: "s1",
    title: "Add a cartTotal function",
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
  steps: steps.map((s, idx) => ({ ...s, idx })),
};
