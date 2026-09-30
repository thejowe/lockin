/**
 * Botón de acción del bloque `descubrir`.
 *
 * Es el `Button` compartido de `src/components/`: mismo alto, misma píldora y
 * mismo press state que el resto de la app. Se mantiene el nombre para no tocar
 * a quien ya lo usa.
 */

import { Button } from '@/components/button';

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return <Button label={label} onPress={onPress} variant={variant} />;
}
