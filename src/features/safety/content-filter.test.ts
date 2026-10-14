import {
  OBJECTIONABLE_MESSAGE,
  ObjectionableContentError,
  findObjectionableContent,
  isObjectionable,
} from './content-filter';

describe('findObjectionableContent', () => {
  it.each([
    ['eres un hijo de puta', 'insulto'],
    ['Gilipollas', 'insulto'],
    ['qué CABRÓN', 'insulto'],
    ['you are a bitch', 'insulto'],
    ['fuck you', 'insulto'],
    ['te voy a matar', 'amenaza'],
    ['ojalá te mueras', 'amenaza'],
    ["i'll kill you", 'amenaza'],
    ['kill yourself', 'amenaza'],
    ['mátate', 'amenaza'],
    ['send nudes', 'sexual'],
    ['manda nudes', 'sexual'],
    ['mira este porno', 'sexual'],
    ['dick pic please', 'sexual'],
  ])('bloquea %s como %s', (text, kind) => {
    expect(findObjectionableContent(text)).toBe(kind);
  });

  it('normaliza leetspeak, alargamientos, plurales y letras separadas', () => {
    expect(isObjectionable('pu7a')).toBe(true);
    expect(isObjectionable('c4br0n')).toBe(true);
    expect(isObjectionable('puuuuta')).toBe(true);
    expect(isObjectionable('p u t a')).toBe(true);
    expect(isObjectionable('b1tch')).toBe(true);
    expect(isObjectionable('putas')).toBe(true);
  });

  it('deja pasar texto legítimo, también con palabras que contienen las listadas', () => {
    for (const text of [
      'Busco cofundador técnico para una startup de logística',
      'Soy desarrollador de assets y assistants',
      'Mi pasión es el classic y el scunthorpe',
      'Quiero matar el tiempo con buenas ideas',
      'Disponible 20 horas a la semana, 2026',
      'As a founder, I like cocktails',
      '',
    ]) {
      expect(findObjectionableContent(text)).toBeNull();
    }
  });

  it('ObjectionableContentError lleva el mensaje claro', () => {
    const error = new ObjectionableContentError('insulto');
    expect(error.message).toBe(OBJECTIONABLE_MESSAGE);
    expect(error.kind).toBe('insulto');
  });
});
