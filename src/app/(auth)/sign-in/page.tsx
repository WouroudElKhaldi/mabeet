import { AuthPage, authMetadata } from "@/modules/accounts";

export const generateMetadata = () => authMetadata("sign-in");

export default function SignInPage() {
  return <AuthPage mode="sign-in" />;
}
