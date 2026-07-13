/**
 * Identity Dashboard (Sprint 18A hardening).
 * Operational metrics for the admin /admin/identity view:
 *   user lifecycle counts, failed logins today, invitation acceptance rate,
 *   recent identity audit events, and recent login history.
 *
 * Tenant-scoped via the standard `prisma` client (active tenant context).
 */
import prisma from "../db";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getIdentityDashboard() {
  const todayStart = startOfToday();

  const [
    usersByStatus,
    invitationsByStatus,
    failedLoginsToday,
    successfulLoginsToday,
    recentLogins,
    recentEvents,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.invitation.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.loginHistory.count({
      where: {
        success: false,
        createdAt: { gte: todayStart },
      },
    }),
    prisma.loginHistory.count({
      where: {
        success: true,
        createdAt: { gte: todayStart },
      },
    }),
    prisma.loginHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: "User",
        action: {
          in: [
            "LOGIN_SUCCESS",
            "LOGIN_FAILED",
            "LOGOUT",
            "ACCOUNT_LOCKED",
            "ACCOUNT_SUSPENDED",
            "ACCOUNT_REACTIVATED",
            "INVITATION_SENT",
            "INVITATION_ACCEPTED",
            "INVITATION_CANCELLED",
            "CLERK_LINKED",
            "FORCE_LOGOUT",
            "TENANT_SUSPENDED_LOGIN_BLOCKED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const statusCount = (status: string) =>
    usersByStatus.find((u) => u.status === status)?._count
      ._all ?? 0;

  const invCount = (status: string) =>
    invitationsByStatus.find((i) => i.status === status)
      ?._count._all ?? 0;

  const totalUsers = usersByStatus.reduce(
    (sum, u) => sum + u._count._all,
    0
  );

  const invitesSent =
    invCount("PENDING") +
    invCount("ACCEPTED") +
    invCount("EXPIRED") +
    invCount("CANCELLED") +
    invCount("REVOKED");
  const invitesAccepted = invCount("ACCEPTED");
  const acceptanceRate =
    invitesSent > 0
      ? Math.round((invitesAccepted / invitesSent) * 100)
      : 0;

  return {
    users: {
      total: totalUsers,
      active: statusCount("ACTIVE"),
      invited: statusCount("INVITED"),
      suspended: statusCount("SUSPENDED"),
      locked: statusCount("LOCKED"),
      deleted: statusCount("DELETED"),
    },
    logins: {
      failedToday: failedLoginsToday,
      successfulToday: successfulLoginsToday,
    },
    invitations: {
      sent: invitesSent,
      pending: invCount("PENDING"),
      accepted: invitesAccepted,
      expired: invCount("EXPIRED"),
      acceptanceRate,
    },
    recentLogins: recentLogins.map((l) => ({
      id: l.id,
      name: l.user?.name ?? "Unknown",
      email: l.user?.email ?? "",
      success: l.success,
      failureReason: l.failureReason,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
    })),
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor,
      reason: e.reason,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt,
    })),
  };
}
