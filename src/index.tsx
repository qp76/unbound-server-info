/**
 * Server Info — Unbound port
 *
 * This is the initial Unbound-native entry point. The menu hook and view are
 * added after confirming the exact guild-menu module on the installed client,
 * so the plugin does not guess at Discord internals or break app startup.
 */

export function start(): void {
  logger.log('Server Info plugin loaded. Guild-menu integration is not enabled yet.');
}
