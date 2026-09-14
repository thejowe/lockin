import AppTabs from '@/components/app-tabs';
import { SessionReminderSync } from '@/features/session';

export default function TabsLayout() {
  return (
    <>
      {/* Avisos de sesiones Lock-In: reconcilia al abrir la app. Ver `src/features/session/`. */}
      <SessionReminderSync />
      <AppTabs />
    </>
  );
}
