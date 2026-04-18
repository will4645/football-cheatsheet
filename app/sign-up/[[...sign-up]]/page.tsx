import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
      <SignUp />
    </div>
  );
}
