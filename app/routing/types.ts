import type { RouteConfigEntry } from "@react-router/dev/routes";

/**
 * One part of the app's routes. `shell` routes render inside the AppShell layout (nav + footer);
 * `standalone` routes sit outside it (auth front door, resource routes without UI).
 * Each area lives in its own file so PRs on different parts of the app do not edit the same file.
 */
export type RouteArea = {
  shell?: RouteConfigEntry[];
  standalone?: RouteConfigEntry[];
};
