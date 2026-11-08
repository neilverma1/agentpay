import { Metadata } from 'next';
import { BASE_URL, SITE_DESCRIPTION, SITE_NAME, formatSiteTitle } from './site-shared';

export const generatePageMetadata = (
  title: string,
  description: string,
  options?: {
    noindex?: boolean;
  },
): Metadata => {
  const formattedTitle = formatSiteTitle(title);

  return {
    title: formattedTitle,
    description,
    robots: {
      index: !options?.noindex,
      follow: true,
    },
    openGraph: {
      title: formattedTitle,
      description,
      url: BASE_URL,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: formattedTitle,
      description,
    },
  };
};

// Page-specific metadata
export const pageMetadata = {
  home: {
    title: 'PayPal payments for AI agents',
    description: SITE_DESCRIPTION,
  },
  chat: {
    title: 'Agent Chat',
    description: 'Interactive autonomous agent commerce workspace and purchase missions.',
  },
  audit: {
    title: 'Audit Logs',
    description: 'Real-time telemetry and compliance audit logs for autonomous agent commerce.',
  },
  profile: {
    title: 'Profile',
    description: 'View and edit your profile information.',
  },
  settings: {
    general: {
      title: 'General Settings',
      description: 'Update your general account settings and preferences.',
    },
    security: {
      title: 'Security Settings',
      description: 'Manage your account security, passwords, and sessions.',
    },
    activity: {
      title: 'Activity',
      description: 'View your account activity and login history.',
    },
  },
  auth: {
    signIn: {
      title: 'Sign In',
      description: 'Sign in to your AgentPay account.',
    },
    signUp: {
      title: 'Sign Up',
      description: 'Create a new agent-pay account.',
    },
    forgotPassword: {
      title: 'Forgot Password',
      description: 'Reset your password.',
    },
    resetPassword: {
      title: 'Reset Password',
      description: 'Create a new password for your account.',
    },
    twoFactor: {
      title: 'Two-Factor Authentication',
      description: 'Enter your two-factor authentication code to verify your identity.',
    },
  },
  goodbye: {
    title: 'Account Deleted',
    description: 'Your account has been successfully deleted.',
  },
  notFound: {
    title: '404 - Page Not Found',
    description: 'The page you are looking for could not be found.',
  },
  error: {
    title: 'Error',
    description: 'An error occurred while processing your request.',
  },
};
