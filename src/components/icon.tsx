/**
 * Iconos de trazo de LockIn.
 *
 * Un solo juego, dibujado a mano en una rejilla de 24 con trazo redondeado de
 * 1.8: el mismo lenguaje que la referencia de diseño (cristal, línea fina). No
 * hay librería de iconos en el proyecto a propósito — son una docena y así se
 * ven idénticos en iOS, Android y web.
 *
 * Decorativos por defecto: quien los use dentro de un control pone la etiqueta
 * accesible en el control, no aquí.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'discover'
  | 'chat'
  | 'person'
  | 'pair'
  | 'focus'
  | 'both'
  | 'heart'
  | 'close'
  | 'expand'
  | 'check'
  | 'flame'
  | 'lock'
  | 'sparkle'
  | 'send'
  | 'document'
  | 'chevrons'
  | 'back';

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(() => {
        switch (name) {
          case 'discover':
            return (
              <>
                <Rect x={5} y={3.5} width={12} height={16} rx={3} {...stroke} />
                <Path d="M19.5 7v10.5" {...stroke} />
              </>
            );
          case 'chat':
            return (
              <Path
                d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"
                {...stroke}
              />
            );
          case 'person':
            return (
              <>
                <Circle cx={12} cy={8.5} r={3.8} {...stroke} />
                <Path d="M4.5 20c.9-3.6 3.8-5.6 7.5-5.6s6.6 2 7.5 5.6" {...stroke} />
              </>
            );
          case 'pair':
            return (
              <>
                <Circle cx={9} cy={8} r={3.2} {...stroke} />
                <Circle cx={16.5} cy={9} r={2.6} {...stroke} />
                <Path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" {...stroke} />
                <Path d="M15 14.6c2.6-.3 4.7 1.2 5.3 4.4" {...stroke} />
              </>
            );
          case 'focus':
            return (
              <>
                <Circle cx={12} cy={13} r={7} {...stroke} />
                <Path d="M12 9.5V13l2.2 1.6" {...stroke} />
                <Path d="M9.5 3h5" {...stroke} />
              </>
            );
          case 'both':
            return (
              <>
                <Circle cx={9} cy={12} r={5.5} {...stroke} />
                <Circle cx={15} cy={12} r={5.5} {...stroke} />
              </>
            );
          case 'heart':
            return (
              <Path
                d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
                {...stroke}
              />
            );
          case 'close':
            return <Path d="M6 6l12 12M18 6L6 18" {...stroke} />;
          case 'expand':
            return <Path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" {...stroke} />;
          case 'check':
            return <Path d="M5 12.5l4.2 4.2L19 7" {...stroke} />;
          case 'flame':
            return (
              <Path
                d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.7 3.2-5.6 3.8-9.5 2.3 1.4 3.4 3.3 3.6 5.2 1-.6 1.7-1.6 2-2.8 2 1.6 3.6 4.1 3.6 7.1 0 3.4-2.6 6-6.5 6z"
                {...stroke}
              />
            );
          case 'lock':
            return (
              <>
                <Rect x={5} y={10.5} width={14} height={10} rx={3} {...stroke} />
                <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" {...stroke} />
              </>
            );
          case 'sparkle':
            return (
              <Path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z" {...stroke} />
            );
          case 'send':
            return <Path d="M12 19V5M6 11l6-6 6 6" {...stroke} />;
          case 'chevrons':
            // Tres galones que se encienden hacia la derecha: «adelante».
            return (
              <>
                <Path d="M4 7l4 5-4 5" {...stroke} strokeOpacity={0.3} />
                <Path d="M10 7l4 5-4 5" {...stroke} strokeOpacity={0.6} />
                <Path d="M16 7l4 5-4 5" {...stroke} />
              </>
            );
          case 'back':
            return <Path d="M15 5l-7 7 7 7" {...stroke} />;
          case 'document':
            return (
              <>
                <Path d="M7 3.5h7l4 4V20.5H6.5V3.5z" {...stroke} />
                <Path d="M9 12h6M9 15.5h4" {...stroke} />
              </>
            );
        }
      })()}
    </Svg>
  );
}
