// Keep math fonts and styles off the initial page load, but load them before
// publishing the plugin so the visual and accessible equations do not overlap.
import "katex/dist/katex.min.css";

export { math } from "@streamdown/math";
