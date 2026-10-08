import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { MongoClient } from "mongodb";

declare global {
  var authMongoClient: MongoClient | undefined;
}

// Connects lazily on first use, so importing this during `next build` without a database is fine.
const client = (global.authMongoClient ??= new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/crackquick"));

/** A social login is offered only when both its id and secret are set in the environment. */
function provider(id: string | undefined, secret: string | undefined) {
  return id && secret ? { clientId: id, clientSecret: secret } : undefined;
}

const socialProviders = {
  github: provider(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET),
  google: provider(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET),
};

export type SocialProvider = keyof typeof socialProviders;

export const enabledSocialProviders = (Object.keys(socialProviders) as SocialProvider[]).filter((k) => socialProviders[k]);

export const auth = betterAuth({
  database: mongodbAdapter(client.db(), { client }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: Object.fromEntries(Object.entries(socialProviders).filter(([, v]) => v)),
  account: {
    // Same verified email on GitHub and Google signs in to the same account.
    accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
  },
  user: {
    // Changed only by admins (Users page) or `npm run set-role`; see src/lib/rbac.ts.
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
  },
  session: {
    // Saves a database read on most requests; a sign-out elsewhere takes up to this long to apply.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [nextCookies()],
});
