import { normalizePhone, phoneProblem } from './phone';

describe('phone', () => {
  it('normaliza espacios, guiones, puntos y paréntesis', () => {
    expect(normalizePhone('+34 600-123.456')).toBe('+34600123456');
    expect(normalizePhone('(600) 123 456')).toBe('600123456');
  });

  it('acepta móviles reales de varios países', () => {
    expect(phoneProblem('600123456')).toBeNull();
    expect(phoneProblem('+34 600 123 456')).toBeNull();
    expect(phoneProblem('+34 712 345 678')).toBeNull();
    expect(phoneProblem('+44 7700 900123')).toBeNull();
    expect(phoneProblem('+1 415 555 2671')).toBeNull();
    expect(phoneProblem('+33 6 12 34 56 78')).toBeNull();
    expect(phoneProblem('+351 912 345 678')).toBeNull();
    expect(phoneProblem('+52 55 1234 5678')).toBeNull();
    expect(phoneProblem('+55 11 91234 5678')).toBeNull();
    expect(phoneProblem('+57 312 345 6789')).toBeNull();
  });

  it('rechaza vacío, cortos, largos y con letras', () => {
    expect(phoneProblem('  ')).toMatch(/Escribe tu número/);
    expect(phoneProblem('12345')).toMatch(/no existe/);
    expect(phoneProblem('1234567890123456')).toMatch(/no existe/);
    expect(phoneProblem('600abc456')).toMatch(/no existe/);
  });

  it('en España exige 9 dígitos que empiecen por 6 o 7', () => {
    expect(phoneProblem('+34 912 345 678')).toMatch(/no existe/); // fijo
    expect(phoneProblem('+34 500 123 456')).toMatch(/no existe/);
    expect(phoneProblem('+34 600 123 45')).toMatch(/no existe/); // 8 dígitos
    expect(phoneProblem('+34 600 123 4567')).toMatch(/no existe/); // 10 dígitos
  });

  it('rechaza números inventados con todos los dígitos iguales', () => {
    expect(phoneProblem('2222222222222')).toMatch(/no existe/);
    expect(phoneProblem('+34 666 666 666')).toMatch(/no existe/);
    expect(phoneProblem('+1 222 222 2222')).toMatch(/no existe/);
  });

  it('aplica la regla de cada país', () => {
    expect(phoneProblem('+44 6700 900123')).toMatch(/no existe/); // móvil UK empieza por 7
    expect(phoneProblem('+33 1 12 34 56 78')).toMatch(/no existe/);
    expect(phoneProblem('+1 115 555 2671')).toMatch(/no existe/); // NANP no empieza por 0/1
  });

  it('con un país sin regla propia solo exige una longitud razonable', () => {
    expect(phoneProblem('+375 29 123 4567')).toBeNull();
    expect(phoneProblem('+375 1')).toMatch(/no existe/);
  });
});
