import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/developer")({
  head: () => ({ meta: [{ title: "لوحة المطور — ERP" }] }),
  component: () => <Outlet />,
});