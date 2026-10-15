import AppTabs from '@/components/app-tabs';
import { RequireVerifiedEmail } from '@/features/profile';

export default function TabsLayout() {
  return (
    <RequireVerifiedEmail>
      <AppTabs />
    </RequireVerifiedEmail>
  );
}
