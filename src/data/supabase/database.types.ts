/**
 * Tipos de la base de datos, escritos a mano.
 *
 * Lo normal sería generarlos con `supabase gen types typescript`, pero eso
 * requiere un proyecto enlazado con un access token. Mientras eso no exista,
 * este archivo es la traducción literal de `supabase/migrations/`: si cambia
 * una migración, cambia aquí. El mapeo columna ↔ campo de dominio vive en
 * `mappers.ts`, no aquí.
 *
 * Los enums de Postgres son los mismos literales que las uniones de
 * `src/data/types.ts`, así que se reutilizan en vez de duplicarse: si alguien
 * añade una especialidad en `types.ts` sin la migración `alter type`, esto
 * sigue compilando pero la inserción falla en runtime — el aviso está en la
 * cabecera de `20260905000100_enums_and_helpers.sql`.
 */

import type {
  Ambition,
  Avatar,
  Decision,
  Mode,
  ModePreference,
  ProfilePrompt,
  Specialty,
  StartingPoint,
  TimeBand,
} from '../types';

/** Fila de `public.profiles`. `Availability` y `ProfileLinks` van aplanados. */
export type ProfileRow = {
  id: string;
  name: string;
  age: number;
  location: string;
  timezone: string;
  avatar_initials: string;
  avatar_accent: Avatar['accent'];
  specialties: Specialty[];
  /**
   * Lo que el perfil busca que domine la otra persona. Puede ir vacío —es lo
   * que declara un perfil de lock-in—, al contrario que `specialties`, que
   * exige al menos una.
   */
  seeking_specialties: Specialty[];
  looking_for: ModePreference;
  starting_point: StartingPoint;
  availability_hours_per_week: number;
  availability_bands: TimeBand[];
  ambition: Ambition;
  link_github: string | null;
  link_portfolio: string | null;
  link_linkedin: string | null;
  /** `ProfilePrompt[]` serializado como jsonb. Máximo 2 elementos. */
  prompts: ProfilePrompt[];
  created_at: string;
  updated_at: string;
};

/** Lo que se envía al crear o actualizar un perfil. */
export type ProfileInsert = Omit<ProfileRow, 'created_at' | 'updated_at'>;

/** Fila de `public.user_settings`. */
export type UserSettingsRow = {
  user_id: string;
  active_mode: ModePreference | null;
  created_at: string;
  updated_at: string;
};

/** Fila de `public.decisions`. Solo se leen las propias (`actor_id`). */
export type DecisionRow = {
  actor_id: string;
  target_id: string;
  decision: Decision;
  created_at: string;
};

/**
 * Fila de `public.matches`. El par va ordenado canónicamente
 * (`profile_a < profile_b`); la tupla `[propio, otro]` del contrato se
 * reconstruye en `mappers.ts`.
 */
export type MatchRow = {
  id: string;
  profile_a: string;
  profile_b: string;
  mode: Mode;
  created_at: string;
  last_message_at: string | null;
};

/** Fila de `public.messages`. */
export type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  sent_at: string;
};

export type MessageInsert = Pick<MessageRow, 'match_id' | 'sender_id' | 'body'>;

/**
 * Forma del esquema que consume `createClient<Database>`.
 *
 * Solo declara lo que la app usa. `Views` va vacío a propósito: no hay vistas.
 *
 * Todo esto son alias de tipo y no interfaces a propósito: `createClient` exige
 * que cada `Row` encaje en `Record<string, unknown>`, y TypeScript solo da
 * índice implícito a los alias. Con `interface`, el cliente entero degrada a
 * `never` y cada consulta deja de tipar.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: Pick<UserSettingsRow, 'user_id'> & Partial<UserSettingsRow>;
        Update: Partial<UserSettingsRow>;
        Relationships: [];
      };
      decisions: {
        Row: DecisionRow;
        Insert: Omit<DecisionRow, 'created_at'>;
        Update: Partial<Omit<DecisionRow, 'created_at'>>;
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        // Un cliente no inserta ni actualiza matches: los crea `record_decision()`
        // y `last_message_at` lo mueve un trigger. `Record<string, never>` hace
        // que un `.insert()` accidental falle al compilar, no en producción
        // contra una política RLS.
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'matches_profile_a_fkey';
            columns: ['profile_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_profile_b_fkey';
            columns: ['profile_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        // El MVP no edita ni borra mensajes (ver las políticas RLS).
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'messages_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      /** `discovery_deck(p_mode, p_specialties, p_limit)` → `setof profiles`. */
      discovery_deck: {
        Args: {
          p_mode?: ModePreference | null;
          p_specialties?: Specialty[] | null;
          p_limit?: number | null;
        };
        Returns: ProfileRow[];
      };
      /**
       * `record_decision(p_target_id, p_decision)` → la fila de `matches`
       * creada, o `null` si el like no fue recíproco o la decisión fue `pass`.
       */
      record_decision: {
        Args: { p_target_id: string; p_decision: Decision };
        Returns: MatchRow | null;
      };
    };
    Enums: {
      mode: Mode;
      mode_preference: ModePreference;
      specialty: Specialty;
      starting_point: StartingPoint;
      ambition: Ambition;
      time_band: TimeBand;
      avatar_accent: Avatar['accent'];
      decision: Decision;
    };
    CompositeTypes: Record<never, never>;
  };
};
