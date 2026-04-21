import PublicViewerClient from "./PublicViewerClient";

export default async function PublicViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicViewerClient mapId={token} />;
}
