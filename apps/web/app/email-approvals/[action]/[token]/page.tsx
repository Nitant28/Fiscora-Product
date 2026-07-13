import EmailApprovalClient from "./EmailApprovalClient";

export default async function EmailApprovalPage({
  params,
}: {
  params: Promise<{ action: string; token: string }>;
}) {
  const { action, token } = await params;

  return (
    <EmailApprovalClient action={action} token={token} />
  );
}
