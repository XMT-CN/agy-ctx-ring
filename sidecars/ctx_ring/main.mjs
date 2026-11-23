/**
 * Headless background daemon for the agy-ctx-ring Antigravity plugin.
 *
 * Runs with `has_web_ui: false` (no Auxiliary Pane tab/menu entry) and mounts
 * the native-themed composer pill + click-to-open popover via runtime CDP.
 */

import { startCdpInjector } from './cdp_injector.mjs';
import { readConversationMetrics, readRecentConversationMetrics } from './telemetry.mjs';

const cdp = startCdpInjector({
  readMetrics: (convId) => readConversationMetrics(convId),
  readRecentMetrics: (limit) => readRecentConversationMetrics(limit),
});

const shutdown = async () => {
  try {
    await cdp.stop();
  } catch {}
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
