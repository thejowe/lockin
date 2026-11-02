import { normalizePhone, phoneProblem } from './phone';

describe('phone', () => {
  it('normaliza a la forma internacional canónica', () => {
    expect(normalizePhone('+34 600-123.456')).toBe('+34600123456');
    expect(normalizePhone('(600) 123 456')).toBe('+34600123456');
  });

  it('quita el 0 nacional escrito tras el prefijo', () => {
    expect(phoneProblem('+33 06 12 34 56 78')).toBeNull();
    expect(normalizePhone('+33 06 12 34 56 78')).toBe('+33612345678');
  });

  it('acepta números reales de varios países', () => {
    expect(phoneProblem('600123456')).toBeNull();
    expect(phoneProblem('+34 600 123 456')).toBeNull();
    expect(phoneProblem('+44 7400 123456')).toBeNull();
    expect(phoneProblem('+1 202 456 1111')).toBeNull();
    expect(phoneProblem('+52 55 1234 5678')).toBeNull();
  });

  it('rechaza números con buena pinta que el plan de su país no contempla', () => {
    expect(phoneProblem('+34 123456789')).toMatch(/no existe/);
    expect(phoneProblem('+34 000000000')).toMatch(/no existe/);
    expect(phoneProblem('+44 123456789')).toMatch(/no existe/);
    expect(phoneProblem('+1 123 456 7890')).toMatch(/no existe/);
  });

  it('rechaza vacío, cortos, largos y con letras', () => {
    expect(phoneProblem('  ')).toMatch(/Escribe tu número/);
    expect(phoneProblem('12345')).toMatch(/no existe/);
    expect(phoneProblem('1234567890123456')).toMatch(/no existe/);
    expect(phoneProblem('600abc456')).toMatch(/no existe/);
  });
});
