import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsForm } from "./SettingsForm";
import { ResetDataPanel } from "./ResetDataPanel";

export default async function SettingsPage() {
  const user = await requirePermissionPage("settings:read");
  const canWrite = await can("settings:write");

  const s = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });

  return (
    <>
      <PageHeader title="Settings" description="Company profile and tax configuration." />
      {s ? (
        <SettingsForm
          initial={{
            name: s.name,
            tin: s.tin,
            address: s.address,
            pcabLicenseNo: s.pcabLicenseNo,
            vatRegistered: s.vatRegistered,
            vatRate: s.vatRate,
            isTopWithholdingAgent: s.isTopWithholdingAgent,
            allowAdminSelfApproveAdjustment: s.allowAdminSelfApproveAdjustment,
          }}
          canWrite={canWrite}
        />
      ) : (
        <p className="text-sm text-muted">Company settings have not been configured yet.</p>
      )}

      {user.role === "ADMIN" ? <ResetDataPanel /> : null}
    </>
  );
}
