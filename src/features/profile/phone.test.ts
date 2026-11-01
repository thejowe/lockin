import { normalizePhone, phoneProblem } from './phone';

describe('phone', () => {
  it('normaliza espacios, guiones, puntos y paréntesis', () => {
    expect(normalizePhone('+34 600-123.456')).toBe('+34600123456');
    expect(normalizePhone('(600) 123 456')).toBe('600123456');
  });

  it('acepta números de 9 a 15 dígitos con + opcional', () => {
    expect(phoneProblem('600123456')).toBeNull();
    expect(phoneProblem('+34 600 123 456')).toBeNull();
  });

  it('rechaza vacío, cortos, largos y con letras', () => {
    expect(phoneProblem('  ')).toMatch(/Escribe tu número/);
    expect(phoneProblem('12345')).toMatch(/no parece válido/);
    expect(phoneProblem('1234567890123456')).toMatch(/no parece válido/);
    expect(phoneProblem('600abc456')).toMatch(/no parece válido/);
  });
});
