// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // send `/` straight to `/listen`
  return <Redirect href="/listen" />;
}