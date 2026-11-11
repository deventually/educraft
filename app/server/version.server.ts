import pkg from "../../package.json";

/**
 * The running version: package.json's `version`, which a release PR raises and the release tag
 * repeats (BESLUIT-2026-11-11-4). `0.0.0` until the first release.
 */
export const APP_VERSION: string = pkg.version;
