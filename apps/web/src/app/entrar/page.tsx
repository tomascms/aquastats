import { LoginForm } from "@/components/auth/login-form";

export default function EntrarPage() {
  // Read per request (the layout is dynamic): adding the key to the worker turns Turnstile on, no rebuild.
  return <LoginForm turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || ""} />;
}
