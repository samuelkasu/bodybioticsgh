/* eslint-disable @typescript-eslint/no-require-imports */
const JSDOMEnvironment = require("jest-environment-jsdom").default;

// jsdom has no fetch, and its AbortSignal is rejected by Node's Request
// (cross-realm), so the whole fetch family has to come from Node together.
const NODE_GLOBALS = [
  "fetch",
  "Headers",
  "Request",
  "Response",
  "FormData",
  "AbortController",
  "AbortSignal",
  "ReadableStream",
  "TransformStream",
  "structuredClone",
  "BroadcastChannel",
];

class NextJsdomEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    for (const key of NODE_GLOBALS) {
      if (globalThis[key] !== undefined) {
        this.global[key] = globalThis[key];
      }
    }
  }
}

module.exports = NextJsdomEnvironment;
