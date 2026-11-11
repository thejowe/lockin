// Copy de servidor. Fallback en inglés, igual que la app. Nunca interpola una
// identidad en likes gratis: el RPC devuelve first_name/first_super nulos.
const copy = {
  es: {
    one: 'Tienes un like nuevo',
    many: 'Tienes {n} likes nuevos',
    anonymousOne: 'Alguien te ha dado like. Entra para verlo.',
    anonymousMany: '{n} personas te han dado like. Entra para verlo.',
    named: '{name} te ha dado like',
    super: '{name} te ha dado un Super Like',
    reply: 'Ábrelo para devolverle el like o pasar.',
    others: '{name} y {rest} más te han dado like.',
    match: '¡Es un match!',
    matchBody: 'Tú y {name} os habéis dado like. Empieza a hablar.',
    messages: 'Tienes mensajes nuevos',
    messagesBody: 'Entra en cofounder para leerlos.',
    premium: 'Tu Premium termina mañana',
    premiumBody:
      'A partir de entonces dejarás de ver quién te ha dado like y los demás beneficios.',
    'joined-self': 'Has entrado en {group}',
    'joined-selfBody': 'Ya formas parte del grupo. Saluda en el chat.',
    joined: '{name} se ha unido a {group}',
    joinedBody: 'Ya puedes saludarle en el chat.',
    kicked: 'Ya no formas parte de {group}',
    kickedBody: 'La persona que administra el grupo te ha sacado.',
    'group-like': 'A {name} le interesa {group}',
    'group-likeBody': 'Entra para ver la candidatura.',
  },
  en: {
    one: 'You have 1 new like',
    many: 'You have {n} new likes',
    anonymousOne: 'Someone liked you. Open cofounder to see it.',
    anonymousMany: '{n} people liked you. Open cofounder to see them.',
    named: '{name} liked you',
    super: '{name} sent you a Super Like',
    reply: 'Open it to like them back or pass.',
    others: '{name} and {rest} others liked you.',
    match: "It's a match!",
    matchBody: 'You and {name} liked each other. Start chatting.',
    messages: 'You have new messages',
    messagesBody: 'Open cofounder to read them.',
    premium: 'Your Premium ends tomorrow',
    premiumBody: 'After that, you will lose access to who liked you and the other benefits.',
    'joined-self': 'You joined {group}',
    'joined-selfBody': 'You are now part of the group. Say hello in the chat.',
    joined: '{name} joined {group}',
    joinedBody: 'You can now say hello in the chat.',
    kicked: 'You are no longer part of {group}',
    kickedBody: 'The group admin removed you.',
    'group-like': '{name} is interested in {group}',
    'group-likeBody': 'Open cofounder to see the candidate.',
  },
  ca: {
    one: 'Tens un like nou',
    many: 'Tens {n} likes nous',
    anonymousOne: "Algú t'ha donat like. Entra per veure'l.",
    anonymousMany: "{n} persones t'han donat like. Entra per veure-ho.",
    named: "{name} t'ha donat like",
    super: "{name} t'ha donat un Super Like",
    reply: "Obre'l per tornar-li el like o passar.",
    others: "{name} i {rest} més t'han donat like.",
    match: 'És un match!',
    matchBody: 'Tu i {name} us heu donat like. Comença a parlar.',
    messages: 'Tens missatges nous',
    messagesBody: 'Entra a cofounder per llegir-los.',
    premium: 'El teu Premium acaba demà',
    premiumBody:
      "A partir de llavors deixaràs de veure qui t'ha donat like i la resta d'avantatges.",
    'joined-self': 'Has entrat a {group}',
    'joined-selfBody': 'Ja formes part del grup. Saluda al xat.',
    joined: "{name} s'ha unit a {group}",
    joinedBody: 'Ja pots saludar aquesta persona al xat.',
    kicked: 'Ja no formes part de {group}',
    kickedBody: "La persona que administra el grup t'ha fet fora.",
    'group-like': 'A {name} li interessa {group}',
    'group-likeBody': 'Entra per veure la candidatura.',
  },
};

export function notificationCopy(row, type) {
  const locale = Object.hasOwn(copy, row.locale) ? row.locale : 'en';
  const dict = copy[locale];
  const vars = {
    n: row.like_count,
    name: row.first_name ?? row.other_name ?? row.person_name,
    rest: row.like_count - 1,
    group: row.group_name,
  };
  const text = (key) => dict[key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  if (type === 'like-digest' || (type === 'reengagement' && row.like_count > 0)) {
    const one = row.like_count === 1;
    // Para 2 en inglés: "1 other", no "1 others".
    let body = row.first_name
      ? text(one ? 'reply' : 'others')
      : text(one ? 'anonymousOne' : 'anonymousMany');
    if (locale === 'en' && row.like_count === 2 && row.first_name)
      body = `${row.first_name} and 1 other liked you.`;
    return {
      title: text(one ? (row.first_name ? (row.first_super ? 'super' : 'named') : 'one') : 'many'),
      body,
    };
  }
  const key =
    type === 'match'
      ? 'match'
      : type === 'premium-expiry'
        ? 'premium'
        : type === 'group-activity'
          ? row.event_kind
          : 'messages';
  return { title: text(key), body: text(`${key}Body`) };
}
