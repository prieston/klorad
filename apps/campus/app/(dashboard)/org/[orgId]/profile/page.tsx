import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Panel } from "@klorad/design-system";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const { name, email, image } = session.user;
  const initial = (name?.charAt(0) || email?.charAt(0) || "U").toUpperCase();

  return (
    <div className="w-full space-y-10 px-6 py-8 md:px-10">
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Account
        </h2>
        <Panel className="flex items-center gap-4 rounded-2xl p-5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-accent">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-text-primary">
              {name ?? "User"}
            </div>
            <div className="truncate text-sm text-text-secondary">{email}</div>
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Preferences
        </h2>
        <Panel className="rounded-2xl p-5">
          <p className="text-sm text-text-secondary">
            Language, default locale, and notification preferences will appear
            here.
          </p>
        </Panel>
      </section>
    </div>
  );
}
