import { z } from 'zod';

const webEnvSchema = z.object({
  NEXT_PUBLIC_WEB_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional()
});

function parseWebEnv() {
  const parsed = webEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid WEB environment configuration', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid WEB environment configuration');
  }

  const apiUrl = parsed.data.NEXT_PUBLIC_WEB_PUBLIC_API_URL ?? parsed.data.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    return { NEXT_PUBLIC_WEB_PUBLIC_API_URL: apiUrl };
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Invalid WEB environment configuration', {
      NEXT_PUBLIC_WEB_PUBLIC_API_URL: ['Required in production']
    });
    throw new Error('Invalid WEB environment configuration');
  }

  return { NEXT_PUBLIC_WEB_PUBLIC_API_URL: 'http://localhost:4000' };
}

const parsedWebEnv = parseWebEnv();

export function getWebEnv() {
  return parsedWebEnv;
}
