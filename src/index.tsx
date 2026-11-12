import { flux, metro, patcher } from '@unbound-app/api';

type AnyStore = any;
type Guild = any;
type Friend = { id: string; username: string; globalName?: string | null; nick?: string | null };

const h = React.createElement;
const RN = metro.common.ReactNative;
const ActionSheetModule = metro.findByProps('ActionSheet');
const ActionSheet = ActionSheetModule?.ActionSheet ?? RN.View;
const CloseButtonModule = metro.findByProps('ActionSheetCloseButton');
const ActionSheetCloseButton = CloseButtonModule?.ActionSheetCloseButton;
const SheetActions = metro.findByProps('hideActionSheet', 'openLazy') ?? metro.findByProps('hideActionSheet');
const hideSheet = () => {
  try { SheetActions?.hideActionSheet?.(); } catch {}
};
const getStore = (name: string): AnyStore => {
  try { return flux.getStore(name); } catch { return undefined; }
};
const textColor = '#f2f3f5';
const mutedColor = '#b5bac1';
const panelColor = '#2b2d31';
const lineColor = '#3f4248';

function getCreatedDate(id: string) {
  try {
    return new Date(Number((BigInt(id) >> 22n) + 1420070400000n))
      .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return '—'; }
}

function openProfile(userId: string, guildId: string) {
  try {
    hideSheet();
    const profileModal = metro.findByProps('openUserProfileModal');
    const profileAction = metro.findByProps('openUserProfile');
    const legacyProfile = metro.findByProps('showUserProfile');
    if (profileModal?.openUserProfileModal) profileModal.openUserProfileModal({ userId, guildId });
    else if (profileAction?.openUserProfile) profileAction.openUserProfile({ userId, guildId });
    else if (legacyProfile?.showUserProfile) legacyProfile.showUserProfile({ userId, guildId });
    else logger.warn('Server Info: no user profile action was found.');
  } catch (error) {
    logger.warn('Server Info: could not open profile', error);
  }
}

async function loadGuildFriends(guildId: string): Promise<Friend[]> {
  const relationships = getStore('RelationshipStore') ?? metro.findByProps('getFriendIDs');
  const members = getStore('GuildMemberStore');
  const users = getStore('UserStore') ?? metro.findByProps('getUser');
  // Discord's member-by-ID action is not exposed consistently across builds.
  // Keep the dispatcher fallback so the request still reaches the gateway.
  const dispatcher = metro.findByProps('dispatch', 'subscribe', 'unsubscribe')
    ?? metro.findByProps('dispatch', 'subscribe');
  const actions = metro.findByProps('requestMembers', 'requestMembersById')
    ?? metro.findByProps('requestMembersById');
  const rawFriendIds = relationships?.getFriendIDs?.() ?? [];
  const ids: string[] = Array.from(new Set(Array.from(rawFriendIds as any).map((id: any) => String(id))));
  if (!ids.length) return [];
  const requestBatch = (batch: string[]) => {
    if (!batch.length) return;
    try {
      if (typeof actions?.requestMembersById === 'function') {
        actions.requestMembersById(guildId, batch, false);
      } else {
        dispatcher?.dispatch?.({
          type: 'GUILD_MEMBERS_REQUEST',
          guildIds: [guildId],
          userIds: batch,
          presences: false
        });
      }
    } catch (error) {
      logger.warn('Server Info: member request failed', error);
    }
  };

  const received = new Map<string, any>();
  if (dispatcher?.subscribe && dispatcher?.unsubscribe) {
    await new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { dispatcher.unsubscribe('GUILD_MEMBERS_CHUNK', onChunk); } catch {}
        resolve();
      };
      const onChunk = (data: any) => {
        const eventGuildId = String(data?.guildId ?? data?.guild_id ?? '');
        if (eventGuildId !== guildId) return;
        const chunkMembers = Array.isArray(data?.members) ? data.members : [];
        for (const entry of chunkMembers) {
          const userId = String(entry?.user?.id ?? entry?.userId ?? entry?.user_id ?? '');
          if (userId) received.set(userId, entry);
        }
        // Multiple chunks can arrive; wait briefly after each one for the rest.
        clearTimeout(timer);
        timer = setTimeout(done, 350);
      };
      let timer: ReturnType<typeof setTimeout> = setTimeout(done, 2200);
      try {
        dispatcher.subscribe('GUILD_MEMBERS_CHUNK', onChunk);
        // Discord limits user_ids requests to 100 IDs per gateway request.
        for (let i = 0; i < ids.length; i += 100) requestBatch(ids.slice(i, i + 100));
      } catch {
        done();
      }
    });
  } else {
    for (let i = 0; i < ids.length; i += 100) requestBatch(ids.slice(i, i + 100));
    await new Promise((resolve) => setTimeout(resolve, 1400));
  }

  const guildMembers = members?.getMembers?.(guildId) ?? {};
  const cachedMember = (id: string) => {
    if (guildMembers instanceof Map) return guildMembers.get(id);
    if (Array.isArray(guildMembers)) return guildMembers.find((entry: any) => String(entry?.userId ?? entry?.user?.id ?? entry?.id) === id);
    return guildMembers?.[id];
  };
  return ids.map((id) => {
    const member = cachedMember(id) ?? members?.getMember?.(guildId, id) ?? received.get(id);
    if (!member) return null;
    const user = users?.getUser?.(id) ?? member?.user;
    return {
      id,
      username: user?.username ?? 'Unknown user',
      globalName: user?.globalName ?? user?.global_name ?? null,
      nick: member?.nick ?? member?.nickname ?? null
    };
  }).filter(Boolean) as Friend[];
}

function InfoRow(label: string, value: any, onPress?: () => void, avatar?: string | null) {
  return h(RN.TouchableOpacity, {
    key: label,
    disabled: !onPress,
    onPress,
    activeOpacity: onPress ? 0.7 : 1,
    style: {
      minHeight: 48, paddingVertical: 10, paddingHorizontal: 14,
      borderBottomWidth: 0.5, borderBottomColor: lineColor,
      flexDirection: 'row', alignItems: 'center', gap: 10
    }
  },
    avatar ? h(RN.Image, { source: { uri: avatar }, style: { width: 30, height: 30, borderRadius: 15 } }) : null,
    h(RN.View, { style: { flex: 1 } },
      h(RN.Text, { style: { color: mutedColor, fontSize: 13 } }, label),
      h(RN.Text, { style: { color: textColor, fontSize: 15, marginTop: 2 }, numberOfLines: 2 }, value == null || value === '' ? '—' : String(value))
    ),
    onPress ? h(RN.Text, { style: { color: '#949ba4', fontSize: 18 } }, '›') : null
  );
}

function Section(title: string) {
  return h(RN.Text, {
    style: { color: '#949ba4', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 7 }
  }, title);
}

function ServerInfoSheet({ guildId }: { guildId: string }) {
  const [guild, setGuild] = React.useState<Guild>(() => getStore('GuildStore')?.getGuild?.(guildId) ?? getStore('Guild')?.getGuild?.(guildId));
  const [friends, setFriends] = React.useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = React.useState(true);
  const [, refresh] = React.useReducer((n: number) => n + 1, 0);
  const [ownerData, setOwnerData] = React.useState<any>(null);
  const [guildDetails, setGuildDetails] = React.useState<any>(null);

  React.useEffect(() => {
    const names = ['GuildStore', 'Guild', 'GuildMemberStore', 'GuildRoleStore', 'GuildChannelStore', 'UserStore'];
    const stores = names.map(getStore).filter(Boolean);
    const update = () => {
      setGuild(getStore('GuildStore')?.getGuild?.(guildId) ?? getStore('Guild')?.getGuild?.(guildId));
      refresh();
    };
    stores.forEach((store: any) => store.addChangeListener?.(update));
    return () => stores.forEach((store: any) => store.removeChangeListener?.(update));
  }, [guildId]);

  React.useEffect(() => {
    let alive = true;
    setFriendsLoading(true);
    loadGuildFriends(guildId).then((items) => {
      if (alive) { setFriends(items); setFriendsLoading(false); }
    }).catch(() => { if (alive) setFriendsLoading(false); });
    return () => { alive = false; };
  }, [guildId]);

  React.useEffect(() => {
    let alive = true;
    const api = metro.findByProps('get', 'post', 'patch', 'del');
    api?.get?.({ url: '/guilds/' + guildId + '?with_counts=true' })
      .then((res: any) => {
        if (alive && res?.body) setGuildDetails(res.body);
      })
      .catch((error: any) => logger.warn('Server Info: could not load server boost details', error));
    return () => { alive = false; };
  }, [guildId]);

  const ownerId = guild?.ownerId ?? guild?.owner_id;
  React.useEffect(() => {
    if (!ownerId) return;
    const users = getStore('UserStore');
    const cached = users?.getUser?.(ownerId);
    if (cached) { setOwnerData(cached); return; }
    let alive = true;
    const api = metro.findByProps('get', 'post', 'patch', 'del');
    api?.get?.({ url: '/users/' + ownerId }).then((res: any) => {
      if (alive && res?.body) setOwnerData(res.body);
    }).catch(() => {});
    return () => { alive = false; };
  }, [ownerId]);

  if (!guild) {
    return h(ActionSheet, { style: { flex: 1, backgroundColor: panelColor } },
      h(RN.View, { style: { flex: 1, minHeight: 220, backgroundColor: panelColor, justifyContent: 'center', alignItems: 'center', padding: 24 } },
        h(RN.Text, { style: { color: textColor } }, 'Server information is unavailable.'),
        h(RN.TouchableOpacity, { onPress: hideSheet, style: { padding: 14 } }, h(RN.Text, { style: { color: '#00a8fc' } }, 'Close'))
      )
    );
  }

  const roles = getStore('GuildRoleStore')?.getSortedRoles?.(guildId) ?? getStore('GuildRole')?.getSortedRoles?.(guildId);
  const channels = getStore('GuildChannelStore')?.getChannels?.(guildId) ?? getStore('GuildChannel')?.getChannels?.(guildId);
  const channelCount = channels ? Object.values(channels).reduce((total: number, item: any) => total + (Array.isArray(item) ? item.length : 1), 0) : null;
  const memberStore = getStore('GuildMemberStore');
  const memberCountStore = metro.findByProps('getMemberCount', 'getOnlineCount');
  const countsStore = getStore('GuildHeaderCountsStore') ?? memberCountStore;
  const memberCount = memberCountStore?.getMemberCount?.(guildId) ?? guild.memberCount ?? guild.approximateMemberCount ?? memberStore?.getMemberIds?.(guildId)?.length;
  const onlineCount = countsStore?.getOnlineCount?.(guildId);
  const owner = ownerData ?? getStore('UserStore')?.getUser?.(ownerId);
  const boostTier = guildDetails?.premium_tier ?? guildDetails?.premiumTier ?? guild?.premiumTier ?? guild?.premium_tier ?? 0;
  const boostCount = guildDetails?.premium_subscription_count ?? guildDetails?.premiumSubscriptionCount ?? guild?.premiumSubscriptionCount ?? guild?.premium_subscription_count ?? guild?.premiumSubscriberCount;
  const ownerName = owner?.globalName ?? owner?.global_name ?? owner?.username ?? (ownerId ? 'User ' + ownerId.slice(0, 6) : 'Unavailable');
  const ownerAvatar = owner?.avatar && ownerId
    ? 'https://cdn.discordapp.com/avatars/' + ownerId + '/' + owner.avatar + '.' + (owner.avatar.startsWith('a_') ? 'gif' : 'png') + '?size=64'
    : null;
  const icon = guild.icon ? 'https://cdn.discordapp.com/icons/' + guildId + '/' + guild.icon + '.' + (guild.icon.startsWith('a_') ? 'gif' : 'png') + '?size=128' : null;
  const banner = guild.banner ? 'https://cdn.discordapp.com/banners/' + guildId + '/' + guild.banner + '.' + (guild.banner.startsWith('a_') ? 'gif' : 'png') + '?size=512' : null;

  return h(ActionSheet, { style: { flex: 1, backgroundColor: panelColor } },
    h(RN.View, { style: { flex: 1, minHeight: 0, backgroundColor: panelColor } },
      h(RN.View, { style: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: panelColor, borderBottomWidth: 0.5, borderBottomColor: lineColor } },
        h(RN.Text, { style: { color: textColor, fontSize: 17, fontWeight: '700', flex: 1 } }, 'Server Information'),
        ActionSheetCloseButton
          ? h(ActionSheetCloseButton, { onPress: hideSheet })
          : h(RN.TouchableOpacity, { onPress: hideSheet, hitSlop: { top: 12, bottom: 12, left: 12, right: 12 } }, h(RN.Text, { style: { color: '#00a8fc', fontSize: 15 } }, 'Close'))
      ),
      h(RN.ScrollView, { style: { flex: 1, backgroundColor: panelColor }, contentContainerStyle: { paddingBottom: 28 }, keyboardShouldPersistTaps: 'handled' },
        banner ? h(RN.Image, { source: { uri: banner }, style: { width: '100%', height: 112, backgroundColor: '#202225' }, resizeMode: 'cover' }) : null,
        h(RN.View, { style: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: panelColor } },
          icon ? h(RN.Image, { source: { uri: icon }, style: { width: 64, height: 64, borderRadius: 16 } }) : null,
          h(RN.View, { style: { flex: 1 } },
            h(RN.Text, { style: { color: textColor, fontSize: 19, fontWeight: '700' } }, guild.name ?? 'Server'),
            guild.description ? h(RN.Text, { style: { color: mutedColor, fontSize: 13, marginTop: 5 } }, guild.description) : null
          )
        ),
        Section('OVERVIEW'),
        InfoRow('Members', memberCount?.toLocaleString?.() ?? memberCount ?? '—'),
        onlineCount != null ? InfoRow('Online', onlineCount.toLocaleString?.() ?? onlineCount) : null,
        InfoRow('Friends in Server', friendsLoading ? 'Loading…' : friends.length + (friends.length === 1 ? ' friend' : ' friends')),
        !friendsLoading && friends.length
          ? h(RN.View, { style: { backgroundColor: panelColor } }, ...friends.map((friend) => {
              const display = friend.nick || friend.globalName || friend.username;
              const avatarHash = getStore('UserStore')?.getUser?.(friend.id)?.avatar;
              const avatarUrl = avatarHash
                ? 'https://cdn.discordapp.com/avatars/' + friend.id + '/' + avatarHash + '.' + (avatarHash.startsWith('a_') ? 'gif' : 'png') + '?size=64'
                : 'https://cdn.discordapp.com/embed/avatars/0.png';
              return InfoRow(display, '@' + friend.username, () => openProfile(friend.id, guildId), avatarUrl);
            }))
          : null,
        InfoRow('Roles', Array.isArray(roles) ? roles.length : '—'),
        InfoRow('Channels', channelCount ?? '—'),
        InfoRow('Boost level', boostTier),
        InfoRow('Boosts', boostCount == null ? 'Unavailable' : Number(boostCount).toLocaleString()),
        Section('SERVER DETAILS'),
        InfoRow('Owner', ownerName, ownerId ? () => openProfile(ownerId, guildId) : undefined, ownerAvatar),
        InfoRow('Created', getCreatedDate(guildId)),
        InfoRow('Vanity URL', guild.vanityURLCode ? 'discord.gg/' + guild.vanityURLCode : '—'),
        InfoRow('Server ID', guildId)
      )
    )
  );
}

export function start() {
  const mod = metro.find((m: any) => m?.default?.name === 'getGuildsBarGuildMenuItems');
  const ActionSheets = metro.api.ActionSheets;
  if (!mod?.default || !ActionSheets?.openLazy) {
    logger.warn('Server Info: guild menu or ActionSheet API was not found.');
    return;
  }

  patcher.after(mod, 'default', ({ args, result }: any) => {
    const guildId = args?.[0] == null ? null : String(args[0]);
    if (!guildId || !Array.isArray(result)) return result;
    if (result.some((item: any) => item?.label === 'Server Info')) return result;
    // Do not use metro.findByName() here: on some Discord builds it returns
    // a module object rather than a renderable React component. ContextMenuItem
    // passes IconComponent directly to React.createElement, which crashes on it.
    // Use a local component consistently across Unbound/Discord versions.
    const ServerInfoMenuIcon = (props: any) => h(RN.View, {
      accessible: false,
      pointerEvents: 'none',
      style: {
        width: 18, height: 18, borderRadius: 9,
        borderWidth: 1.7, borderColor: props?.color ?? '#b5bac1',
        alignItems: 'center', justifyContent: 'center',
        marginRight: 1
      }
    }, h(RN.Text, {
      style: {
        color: props?.color ?? '#b5bac1',
        fontSize: 12, lineHeight: 14, fontWeight: '700',
        textAlign: 'center', includeFontPadding: false,
        marginTop: -1
      }
    }, 'i'));
    return [...result, {
      label: 'Server Info',
      IconComponent: ServerInfoMenuIcon,
      action: () => ActionSheets.openLazy(
        Promise.resolve({ default: ServerInfoSheet }),
        'server-info-actionsheet-' + guildId,
        { guildId }
      )
    }];
  });
  logger.log('Server Info is ready.');
}
