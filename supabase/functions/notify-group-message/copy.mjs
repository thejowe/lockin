// Copy de servidor. Fallback en inglés, igual que la app. Nunca interpola una
// identidad en likes gratis: el RPC devuelve first_name/first_super nulos.
const copy = {
  es: {
    created: 'Nuevo proyecto conjunto',
    createdBody: 'Ya podéis trabajar en vuestro proyecto desde el chat.',
    proposed: '¿Publicar en vuestros perfiles?',
    proposedBody: 'Abre el chat para responder a la propuesta.',
    deleted: 'Se ha eliminado vuestro proyecto',
    deletedBody: 'Las tareas y las reuniones siguen en el plan compartido.',
    task: 'Se acerca la fecha límite de una tarea',
    meeting: 'Vuestra reunión empieza pronto',
    one: '¡Tienes un like nuevo! 🔥',
    many: '¡{n} personas te han dado like! 🔥',
    anonymousOne: '¡Alguien quiere conocerte! Entra a descubrir quién 👀',
    anonymousMany: '¿Quién será tu cofundador? ¡Entra y descúbrelo! 👀',
    named: '¡{name} te ha dado like! 🔥',
    super: '¡{name} te ha dado un Super Like! ⭐',
    reply: '¡Ábrelo y devuélvele el like! 😉',
    others: '¡{name} y {rest} más quieren conocerte! 🚀',
    match: '¡Es un match! 🎉',
    matchBody: '¡Tú y {name} os habéis gustado! Rompe el hielo ahora 💬',
    messages: '¡Tienes mensajes nuevos! 💬',
    messagesBody: '¡Alguien te está esperando! Entra a leerlos 👀',
    premium: '¡Tu Premium termina mañana! ⏳',
    premiumBody: '¡Renuévalo para seguir viendo quién te da like! 💎',
    'joined-self': '¡Ya estás en {group}! 🙌',
    'joined-selfBody': '¡Saluda al equipo en el chat! 👋',
    joined: '¡{name} se ha unido a {group}! 🙌',
    joinedBody: '¡Dale la bienvenida en el chat! 👋',
    kicked: 'Ya no formas parte de {group}',
    kickedBody: 'Hay más equipos esperándote. ¡Sigue buscando! 🚀',
    'group-like': '¡A {name} le interesa {group}! 🚀',
    'group-likeBody': '¡Entra a ver su candidatura! 👀',
  },
  en: {
    created: 'New shared project',
    createdBody: 'You can now work on your project together in the chat.',
    proposed: 'Publish on both profiles?',
    proposedBody: 'Open the chat to respond to the proposal.',
    deleted: 'Your shared project was deleted',
    deletedBody: 'Your tasks and meetings are still in the shared plan.',
    task: 'A task is due soon',
    meeting: 'Your meeting starts soon',
    one: 'You have a new like! 🔥',
    many: '{n} people liked you! 🔥',
    anonymousOne: 'Someone wants to meet you! Tap to find out who 👀',
    anonymousMany: 'Could one of them be your cofounder? Tap to find out! 👀',
    named: '{name} liked you! 🔥',
    super: '{name} sent you a Super Like! ⭐',
    reply: 'Open it and like them back! 😉',
    others: '{name} and {rest} others want to meet you! 🚀',
    match: "It's a match! 🎉",
    matchBody: 'You and {name} liked each other! Break the ice now 💬',
    messages: 'You have new messages! 💬',
    messagesBody: 'Someone is waiting for you! Tap to read 👀',
    premium: 'Your Premium ends tomorrow! ⏳',
    premiumBody: 'Renew it to keep seeing who likes you! 💎',
    'joined-self': "You're in {group}! 🙌",
    'joined-selfBody': 'Say hi to the team in the chat! 👋',
    joined: '{name} joined {group}! 🙌',
    joinedBody: 'Give them a warm welcome in the chat! 👋',
    kicked: 'You are no longer part of {group}',
    kickedBody: 'More teams are waiting for you. Keep searching! 🚀',
    'group-like': '{name} is interested in {group}! 🚀',
    'group-likeBody': 'Tap to see their application! 👀',
  },
  ca: {
    created: 'Nou projecte conjunt',
    createdBody: 'Ja podeu treballar en el vostre projecte des del xat.',
    proposed: 'Voleu publicar-lo als vostres perfils?',
    proposedBody: 'Obre el xat per respondre a la proposta.',
    deleted: "S'ha eliminat el vostre projecte",
    deletedBody: 'Les tasques i les reunions continuen al pla compartit.',
    task: "S'acosta la data límit d'una tasca",
    meeting: 'La vostra reunió comença aviat',
    one: 'Tens un like nou! 🔥',
    many: "{n} persones t'han donat like! 🔥",
    anonymousOne: 'Algú et vol conèixer! Entra a descobrir qui 👀',
    anonymousMany: 'Qui serà el teu cofundador? Entra i descobreix-ho! 👀',
    named: "{name} t'ha donat like! 🔥",
    super: "{name} t'ha donat un Super Like! ⭐",
    reply: "Obre'l i torna-li el like! 😉",
    others: '{name} i {rest} més et volen conèixer! 🚀',
    match: 'És un match! 🎉',
    matchBody: 'Tu i {name} us heu agradat! Trenca el gel ara 💬',
    messages: 'Tens missatges nous! 💬',
    messagesBody: "Algú t'està esperant! Entra a llegir-los 👀",
    premium: 'El teu Premium acaba demà! ⏳',
    premiumBody: "Renova'l per continuar veient qui et dona like! 💎",
    'joined-self': 'Ja ets a {group}! 🙌',
    'joined-selfBody': "Saluda l'equip al xat! 👋",
    joined: "{name} s'ha unit a {group}! 🙌",
    joinedBody: 'Dona-li la benvinguda al xat! 👋',
    kicked: 'Ja no formes part de {group}',
    kickedBody: 'Hi ha més equips esperant-te. Continua buscant! 🚀',
    'group-like': 'A {name} li interessa {group}! 🚀',
    'group-likeBody': 'Entra a veure la candidatura! 👀',
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
  if (type === 'project-event' || type === 'project-reminders') {
    const key = row.event_kind;
    return {
      title: text(key),
      body: key === 'task' || key === 'meeting' ? row.item_title : text(`${key}Body`),
    };
  }
  if (type === 'like-digest' || (type === 'reengagement' && row.like_count > 0)) {
    const one = row.like_count === 1;
    // Para 2 en inglés: "1 other", no "1 others".
    let body = row.first_name
      ? text(one ? 'reply' : 'others')
      : text(one ? 'anonymousOne' : 'anonymousMany');
    if (locale === 'en' && row.like_count === 2 && row.first_name)
      body = `${row.first_name} and 1 other want to meet you! 🚀`;
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
