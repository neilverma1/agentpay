import { useMutation } from '@tanstack/react-query';
import { signUp } from '@workspace/auth/client';
import { SignUpFormValues } from '@workspace/contracts';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function useSignUp() {
  const router = useRouter();

  return useMutation({
    mutationFn: (values: SignUpFormValues) => signUp.email(values),
    onSuccess: (data) => {
      if (data?.error) {
        toast.error('Sign Up Failed', {
          description: data.error.message || 'Unable to create account. Please try again.',
        });
        return;
      }
      toast.success('Account Created', {
        description: 'Please check your email to verify your account before signing in.',
      });
      router.push('/sign-in');
    },
    onError: (error: Error) =>
      toast.error('Sign Up Failed', {
        description: error?.message || 'Unable to create account. Please try again.',
      }),
  });
}
