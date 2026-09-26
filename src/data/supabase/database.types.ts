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
  SessionBlocks,
  SessionRating,
  SessionStatus,
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
  github_handle: string | null;
  github_verified_at: string | null;
  link_portfolio: string | null;
  link_linkedin: string | null;
  /** `ProfilePrompt[]` serializado como jsonb. Máximo 2 elementos. */
  prompts: ProfilePrompt[];
  created_at: string;
  updated_at: string;
};

/** Lo que se envía al crear o actualizar un perfil. */
export type ProfileInsert = Omit<
  ProfileRow,
  'created_at' | 'updated_at' | 'github_handle' | 'github_verified_at'
>;

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

/** Fila de `public.lockin_sessions`. */
export type SessionRow = {
  id: string;
  match_id: string;
  proposed_by: string;
  starts_at: string;
  blocks: SessionBlocks;
  status: SessionStatus;
  created_at: string;
  responded_at: string | null;
};

/** Fila de `public.session_attendance`. */
export type SessionAttendanceRow = {
  session_id: string;
  profile_id: string;
  joined_at: string;
  left_at: string | null;
};

/**
 * Fila de `public.session_ratings`. Solo se leen las propias: la política RLS
 * de la tabla es `profile_id = auth.uid()`, no `is_session_member`.
 */
export type SessionRatingRow = {
  session_id: string;
  profile_id: string;
  rating: SessionRating;
  rated_at: string;
};

/** Fila de `match_streaks()`: no es tabla, la calcula el RPC de la Tarea 3. */
export type MatchStreakRow = {
  match_id: string;
  streak_count: number;
  alive_until: string;
};

/** Fila de `public.agreement_answers`. Solo se leen las propias (RLS). */
export type AgreementAnswerRow = {
  match_id: string;
  profile_id: string;
  topic: string;
  option: string;
  note: string | null;
  updated_at: string;
};

/**
 * Fila de `match_agreement()`. Las `theirs_*` son null salvo que el actor haya
 * respondido ese tema (el ciego); `theirs_answered` sale siempre.
 */
export type MatchAgreementRow = {
  topic: string;
  mine_option: string | null;
  mine_note: string | null;
  mine_updated_at: string | null;
  theirs_answered: boolean;
  theirs_option: string | null;
  theirs_note: string | null;
  theirs_updated_at: string | null;
};

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
      // Sin escritura directa: todo pasa por los RPCs de la migración 20260913000100.
      lockin_sessions: {
        Row: SessionRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      session_attendance: {
        Row: SessionAttendanceRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      // La escribe `rate_session` y nadie más; el select sí es directo
      // (`getMyRating`), y lo acota la RLS. Inmutable: ni update ni delete.
      session_ratings: {
        Row: SessionRatingRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      // La escribe `answer_agreement_topic` y nadie más; el select directo
      // solo devuelve las propias. La vista de la pareja es `match_agreement`.
      agreement_answers: {
        Row: AgreementAnswerRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      sync_github_verification: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      /** `discovery_deck(p_mode, p_specialties, p_limit, p_exclude_ids)` → `setof profiles`. */
      discovery_deck: {
        Args: {
          p_mode?: ModePreference | null;
          p_specialties?: Specialty[] | null;
          p_limit?: number | null;
          p_exclude_ids?: string[] | null;
        };
        Returns: ProfileRow[];
      };
      /**
       * `last_messages_for_matches(p_match_ids)` → una fila por match, el
       * mensaje más reciente de cada uno (`distinct on`, que PostgREST no
       * expone directamente).
       */
      last_messages_for_matches: {
        Args: { p_match_ids: string[] };
        Returns: MessageRow[];
      };
      /**
       * `record_decision(p_target_id, p_decision)` → la fila de `matches`
       * creada, o `null` si el like no fue recíproco o la decisión fue `pass`.
       */
      record_decision: {
        Args: { p_target_id: string; p_decision: Decision };
        Returns: MatchRow | null;
      };
      propose_session: {
        Args: { p_match_id: string; p_starts_at: string; p_blocks: SessionBlocks };
        Returns: SessionRow;
      };
      respond_session: {
        Args: { p_session_id: string; p_answer: 'aceptada' | 'rechazada' };
        Returns: SessionRow;
      };
      cancel_session: { Args: { p_session_id: string }; Returns: SessionRow };
      join_session: { Args: { p_session_id: string }; Returns: SessionAttendanceRow };
      leave_session: { Args: { p_session_id: string }; Returns: SessionAttendanceRow };
      rate_session: {
        Args: { p_session_id: string; p_rating: SessionRating };
        Returns: SessionRatingRow;
      };
      answer_agreement_topic: {
        Args: { p_match_id: string; p_topic: string; p_option: string; p_note: string | null };
        Returns: AgreementAnswerRow;
      };
      /** `match_agreement(p_match_id)` → una fila por tema con alguna respuesta. */
      match_agreement: { Args: { p_match_id: string }; Returns: MatchAgreementRow[] };
      /** `ratable_session(p_match_id)` → cero o una fila de `lockin_sessions`. */
      ratable_session: { Args: { p_match_id: string }; Returns: SessionRow[] };
      /**
       * `active_session(p_match_id)` → cero o una fila de `lockin_sessions`: la
       * sesión viva de ese match, resuelta con `now()` de Postgres en vez del
       * reloj del dispositivo.
       */
      active_session: { Args: { p_match_id: string }; Returns: SessionRow[] };
      /** `match_streaks()` → una fila por match del actor con racha viva. */
      match_streaks: { Args: Record<string, never>; Returns: MatchStreakRow[] };
      /** `server_now()` → `timestamptz` serializado. */
      server_now: { Args: Record<string, never>; Returns: string };
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
      session_status: SessionStatus;
      session_rating: SessionRating;
    };
    CompositeTypes: Record<never, never>;
  };
};
