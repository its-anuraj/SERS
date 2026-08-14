import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (isAuthenticated && user?.role === 'responder') {
    return <Redirect href="/(responder)" />;
  }

  if (isAuthenticated && user) {
    return <Redirect href="/(citizen)" />;
  }

  return <Redirect href="/(auth)" />;
}
