import { db, schema } from '@workspace/db';
import {
  changeEmailSchema,
  resetPasswordSchema,
  sendAuthEmail,
  verifyEmailSchema,
} from '@workspace/email';
import {
  changeEmailRateLimiter,
  resetPasswordRateLimiter,
  verifyEmailRateLimiter,
  welcomeEmailRateLimiter,
} from '@workspace/rate-limit';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';

const googleAuthEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const { data, success, error } = resetPasswordSchema.safeParse({
        name: user.name,
        resetUrl: url,
      });
      if (error || !success) {
        throw new Error('Failed to send password reset email');
      }

      await sendAuthEmail({
        emailType: 'reset-password',
        limiter: resetPasswordRateLimiter,
        user,
        data,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { data, success, error } = verifyEmailSchema.safeParse({
        email: user.email,
        name: user.name,
        verificationUrl: url,
      });
      if (error || !success) {
        throw new Error('Failed to send verification email');
      }

      await sendAuthEmail({
        emailType: 'verify-email',
        limiter: verifyEmailRateLimiter,
        user,
        data,
      });
    },
    async afterEmailVerification(user, request) {
      const origin = request ? new URL(request.url).origin : '';

      await sendAuthEmail({
        emailType: 'welcome',
        limiter: welcomeEmailRateLimiter,
        user,
        data: {
          name: user.name,
          getStartedUrl: origin,
        },
      });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        const { data, success, error } = changeEmailSchema.safeParse({
          currentEmail: user.email,
          newEmail,
          name: user.name,
          verificationUrl: url,
        });
        if (error || !success) {
          throw new Error('Failed to send email change confirmation');
        }

        await sendAuthEmail({
          emailType: 'change-email',
          limiter: changeEmailRateLimiter,
          user,
          data,
        });
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders: {
    ...(googleAuthEnabled
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {}),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: googleAuthEnabled ? ['google'] : [],
      updateUserInfoOnLink: true,
    },
  },
  plugins: [
    twoFactor({
      issuer: 'AgentPay',
    }),
  ],
});
