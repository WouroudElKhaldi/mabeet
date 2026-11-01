import { AuthPage, authMetadata } from "@/modules/accounts";

export const generateMetadata = () => authMetadata("sign-up");

export default function SignUpPage() {
  return <AuthPage mode="sign-up" />;
}
