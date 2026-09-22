/**
 * A 4×4 cream JPEG, inlined. Product photos come from the API rather than the
 * bundle, so Next cannot generate a blur for them at build time; handing it
 * this one keeps a tinted panel on screen while the real photo decodes instead
 * of a white hole, at a cost of ~100 bytes per page rather than a request.
 */
export const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKIABP/Z";
