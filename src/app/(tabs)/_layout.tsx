import AppTabs from '@/components/app-tabs';
import { RequireVerifiedEmail } from '@/features/profile';
import { ClearLockInReminders } from '@/features/room';

/**
 * Sin `SessionReminderSync` ni `RoomReminderSync` desde el 2026-10-12: el
 * producto es solo cofundador y las sesiones y salas Lock-In ya no se ven, así
 * que tampoco se programan sus avisos — y los que ya lo estaban se cancelan.
 */
export default function TabsLayout() {
  return (
    <RequireVerifiedEmail>
      <ClearLockInReminders />
      <AppTabs />
    </RequireVerifiedEmail>
  );
}
