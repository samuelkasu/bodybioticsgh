/**
 * Cookie names owned by the .NET API (see backend Program.cs). The frontend
 * only ever checks for presence — issuing, signing and revoking all happen
 * server-side, so there is exactly one owner of a session.
 */
export const SESSION_COOKIE = "bb_session";
export const ANON_CART_COOKIE = "bb_cart";
