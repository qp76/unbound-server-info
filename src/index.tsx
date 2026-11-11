import { flux, metro, patcher } from '@unbound-app/api';

type Guild = {
  id: string;
  name?: string;
  icon?: string | null;
  banner?: string | null;
  description?: string | null;
  ownerId?: string;
  memberCount?: number;
  approximateMemberCount?: number;
  premiumTier?: number;
  premiumSubscriberCount?: number;
  vanityURLCode?: string | null;
};

const h = React.createElement;
const RN = metro.common.ReactNative;

function makeInfoSheet(guildId: string) {
  return function ServerInfoSheet() {
    const [guild, setGuild] = React.useState<Guild | undefined>(() =>
      flux.getStore('Guild')?.getGuild?.(guildId)
    );

    React.useEffect(() => {
      const store = flux.getStore('Guild');
      const update = () => setGuild(store?.getGuild?.(guildId));
      store?.addChangeListener?.(update);
      update();
      return () => store?.removeChangeListener?.(update);
    }, []);

    if (!guild) {
      return h(RN.View, { style: { padding: 24 } },
        h(RN.Text, { style: { color: '#fff', fontSize: 16 } }, 'Server information is unavailable.'));
    }

    const roles = flux.getStore('GuildRole')?.getSortedRoles?.(guildId);
    const channels = flux.getStore('GuildChannel')?.getChannels?.(guildId);
    const roleCount = Array.isArray(roles) ? roles.length : '—';
    const channelCount = channels ? Object.values(channels).reduce((n: number, value: any) => n + (Array.isArray(value) ? value.length : 0), 0) : '—';
    const createdAt = new Date(Number((BigInt(guildId) >> 22n) + 1420070400000n))
      .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const text = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value);
    const row = (label: string, value: unknown) => h(RN.View, {
      key: label,
      style: { paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#454950', flexDirection: 'row', justifyContent: 'space-between', gap: 12 }
    },
      h(RN.Text, { style: { color: '#b5bac1', fontSize: 14, flex: 1 } }, label),
      h(RN.Text, { selectable: true, style: { color: '#f2f3f5', fontSize: 14, flex: 1, textAlign: 'right' } }, text(value))
    );

    const icon = guild.icon
      ? 'https://cdn.discordapp.com/icons/' + guildId + '/' + guild.icon + (guild.icon.startsWith('a_') ? '.gif' : '.png') + '?size=128'
      : undefined;
    const banner = guild.banner
      ? 'https://cdn.discordapp.com/banners/' + guildId + '/' + guild.banner + (guild.banner.startsWith('a_') ? '.gif' : '.png') + '?size=512'
      : undefined;

    return h(RN.ScrollView, { style: { maxHeight: 620, paddingHorizontal: 18 } },
      h(RN.View, { style: { paddingTop: 18, paddingBottom: 14, alignItems: 'center' } },
        banner ? h(RN.Image, { source: { uri: banner }, style: { width: '100%', height: 105, borderRadius: 12, marginBottom: 14 } }) : null,
        icon ? h(RN.Image, { source: { uri: icon }, style: { width: 72, height: 72, borderRadius: 18, marginBottom: 10 } }) : null,
        h(RN.Text, { style: { color: '#f2f3f5', fontSize: 21, fontWeight: '700', textAlign: 'center' } }, guild.name || 'Server Info'),
        guild.description ? h(RN.Text, { style: { color: '#b5bac1', fontSize: 13, marginTop: 8, textAlign: 'center' } }, guild.description) : null
      ),
      h(RN.Text, { style: { color: '#949ba4', fontSize: 12, fontWeight: '700', marginTop: 8 } }, 'SERVER OVERVIEW'),
      row('Members', guild.memberCount ?? guild.approximateMemberCount),
      row('Roles', roleCount),
      row('Channels', channelCount),
      row('Boost level', guild.premiumTier ?? 0),
      row('Boosts', guild.premiumSubscriberCount ?? 0),
      h(RN.Text, { style: { color: '#949ba4', fontSize: 12, fontWeight: '700', marginTop: 20 } }, 'SERVER DETAILS'),
      row('Owner ID', guild.ownerId),
      row('Created', createdAt),
      row('Vanity URL', guild.vanityURLCode ? 'discord.gg/' + guild.vanityURLCode : '—'),
      row('Server ID', guildId),
      h(RN.View, { style: { height: 20 } })
    );
  };
}

export function start() {
  const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');
  const ActionSheets = metro.api.ActionSheets;
  if (!ContextMenus || !ActionSheets) {
    logger.warn('Server Info: Discord context menu or action sheets module was not found.');
    return;
  }

  patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
    const guildId = typeof menu?.key === 'string' ? menu.key : undefined;
    const guild = guildId ? flux.getStore('Guild')?.getGuild?.(guildId) : undefined;
    if (!menu || !Array.isArray(menu.items) || !guildId || !guild) return;
    if (menu.items.some((item: any) => item?.label === 'Server Info')) return;

    menu.items.push({
      label: 'Server Info',
      action: () => {
        ActionSheets.openLazy(
          Promise.resolve({ default: makeInfoSheet(guildId) }),
          'server-info-' + guildId,
          { guildId }
        );
      }
    });
  });

  logger.log('Server Info is ready.');
}
