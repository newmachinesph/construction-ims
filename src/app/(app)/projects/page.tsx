import { asc } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requirePermissionPage, can } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectForm } from "./ProjectForm";
import { ProjectsTable } from "./ProjectsTable";

export default async function ProjectsPage() {
  await requirePermissionPage("project:read");
  const canWrite = await can("project:write");

  const rows = await db.select().from(projects).orderBy(asc(projects.name));

  return (
    <>
      <PageHeader title="Projects" description="Construction sites and contracts tracked for materials." />
      {canWrite ? <ProjectForm /> : null}
      <ProjectsTable rows={rows} />
    </>
  );
}
