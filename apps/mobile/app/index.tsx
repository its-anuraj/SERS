import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user?.role === 'responder') {
    return <Redirect href="/(responder)" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(citizen)" />;
  }

  // Default to citizen emergency mode for public preview
  return <Redirect href="/(citizen)" />;
}
