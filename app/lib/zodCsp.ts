/**
 * Zod without `new Function` (P2, CSP nonces). Zod probes `new Function("")` to decide
 * whether it may compile fast object parsers. Our Content-Security-Policy has no
 * 'unsafe-eval', so in the browser that probe is a CSP violation on every page that parses
 * a schema, even though Zod swallows the error. Jitless parsing skips the probe; the
 * difference in speed is irrelevant for our form-sized inputs. Imported by the root route,
 * so it runs on the server and in the browser before any schema is parsed.
 */
import { z } from "zod";

z.config({ jitless: true });
