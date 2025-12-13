/**
 * Server environment configuration with Zod validation
 * This file centralizes all server-side environment variables and provides type safety.
 */
import { z } from "zod";

// Define the environment schema for variables used on the server
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHADOW_DATABASE_URL: z.string().optional(), // Optional: only needed for prisma migrate dev

  // Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  ANALYZE: z.string().optional(),

  // Website URLs (server-aware)
  NEXT_PUBLIC_WEBSITE_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_WEBSITE_URL is required"),
  NEXT_PUBLIC_APP_URL: z.string().min(1, "NEXT_PUBLIC_APP_URL is required"),

  // Authentication
  SECRET: z.string().min(1, "SECRET is required"),
  NEXTAUTH_URL: z.string().min(1, "NEXTAUTH_URL is required"),
  NEXTAUTH_COOKIE_DOMAIN: z
    .string()
    .min(1, "NEXTAUTH_COOKIE_DOMAIN is required"),

  // Digital Ocean Spaces (private & public)
  DO_SPACES_REGION: z.string().min(1, "DO_SPACES_REGION is required"),
  DO_SPACES_ENDPOINT: z.string().min(1, "DO_SPACES_ENDPOINT is required"),
  DO_SPACES_KEY: z.string().min(1, "DO_SPACES_KEY is required"),
  DO_SPACES_SECRET: z.string().min(1, "DO_SPACES_SECRET is required"),
  DO_SPACES_BUCKET: z.string().min(1, "DO_SPACES_BUCKET is required"),

  // Public Digital Ocean Spaces settings (exposed to client)
  NEXT_PUBLIC_DO_SPACES_FOLDER: z
    .string()
    .min(1, "NEXT_PUBLIC_DO_SPACES_FOLDER is required"),
  NEXT_PUBLIC_DO_SPACES_ENDPOINT: z
    .string()
    .min(1, "NEXT_PUBLIC_DO_SPACES_ENDPOINT is required"),
  NEXT_PUBLIC_DO_SPACES_BUCKET: z
    .string()
    .min(1, "NEXT_PUBLIC_DO_SPACES_BUCKET is required"),

  // Google Maps & Cesium Ion keys (publicly available)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required"),
  NEXT_PUBLIC_CESIUM_ION_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CESIUM_ION_KEY is required"),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required"),
  // APP_URL is already defined as NEXT_PUBLIC_APP_URL above

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  STRIPE_PRO_PRODUCT_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID_MONTHLY: z.string().optional(),
  STRIPE_PRO_PRICE_ID_YEARLY: z.string().optional(),
});

// Parse and validate the environment variables
const parsedEnv = serverEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "Invalid server environment variables:",
    parsedEnv.error.format()
  );
  // It is common to throw an error in production to immediately indicate the misconfiguration.
  throw new Error("Invalid server environment variables");
}

export const serverEnv = parsedEnv.data;

// Optionally, you can export specific configurations for Digital Ocean Spaces
export const doSpacesConfig = {
  region: serverEnv.DO_SPACES_REGION,
  endpoint: serverEnv.DO_SPACES_ENDPOINT,
  key: serverEnv.DO_SPACES_KEY,
  secret: serverEnv.DO_SPACES_SECRET,
  bucket: serverEnv.DO_SPACES_BUCKET,
  public: {
    endpoint: serverEnv.NEXT_PUBLIC_DO_SPACES_ENDPOINT,
    bucket: serverEnv.NEXT_PUBLIC_DO_SPACES_BUCKET,
    folder: serverEnv.NEXT_PUBLIC_DO_SPACES_FOLDER,
  },
};

// Email configuration
export const emailConfig = {
  apiKey: serverEnv.RESEND_API_KEY,
  from: serverEnv.EMAIL_FROM,
  appUrl: serverEnv.NEXT_PUBLIC_APP_URL,
};
