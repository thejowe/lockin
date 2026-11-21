import AppTabs from '@/components/app-tabs';
import { useUnreadCounts } from '@/features/chat';
import { RequireVerifiedEmail } from '@/features/profile';
import { RequirePhoto } from '@/features/profile/require-photo';

/** Las pestañas con el globo de mensajes sin leer en Matches. */
function Tabs() {
  const unread = useUnreadCounts();
  return <AppTabs badges={{ matches: unread.total }} />;
}

export default function TabsLayout() {
  return (
    <RequireVerifiedEmail>
      <RequirePhoto>
        <Tabs />
      </RequirePhoto>
    </RequireVerifiedEmail>
  );
}
