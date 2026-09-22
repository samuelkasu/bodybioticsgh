/**
 * Full-page navigation away from the app — to a payment provider, and nothing
 * else so far. `router.push` cannot do this: the destination is another origin.
 *
 * It is a module of its own because jsdom refuses to let `window.location` be
 * redefined or spied on, so a test covering the redirect has no other seam to
 * hold. One line of indirection buys a test for the step where a customer
 * leaves to pay.
 */
export const leaveApp = (url: string): void => {
  window.location.assign(url);
};
