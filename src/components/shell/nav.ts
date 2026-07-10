import type { ComponentType } from "react";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackageMinus,
  ScrollText,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  Warehouse,
} from "lucide-react";
import { NAV_PERMISSIONS, type Permission } from "@/lib/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission: Permission;
}

/** Ordered nav. Each entry's permission gates its visibility per role. */
export const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: NAV_PERMISSIONS.dashboard },
  { href: "/stock", label: "Stock on hand", icon: Boxes, permission: NAV_PERMISSIONS.stock },
  { href: "/items", label: "Items", icon: Package, permission: NAV_PERMISSIONS.items },
  { href: "/purchase-orders", label: "Purchase orders", icon: ShoppingCart, permission: NAV_PERMISSIONS.purchaseOrders },
  { href: "/goods-receipts", label: "Goods receipts", icon: PackageCheck, permission: NAV_PERMISSIONS.goodsReceipts },
  { href: "/requisitions", label: "Requisitions", icon: ClipboardList, permission: NAV_PERMISSIONS.requisitions },
  { href: "/issuances", label: "Issuances", icon: PackageMinus, permission: NAV_PERMISSIONS.issuances },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft, permission: NAV_PERMISSIONS.transfers },
  { href: "/adjustments", label: "Adjustments", icon: SlidersHorizontal, permission: NAV_PERMISSIONS.adjustments },
  { href: "/suppliers", label: "Suppliers", icon: Factory, permission: NAV_PERMISSIONS.suppliers },
  { href: "/projects", label: "Projects", icon: Building2, permission: NAV_PERMISSIONS.projects },
  { href: "/warehouses", label: "Warehouses", icon: Warehouse, permission: NAV_PERMISSIONS.warehouses },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: NAV_PERMISSIONS.reports },
  { href: "/audit", label: "Audit log", icon: ScrollText, permission: NAV_PERMISSIONS.audit },
  { href: "/users", label: "Users", icon: Users, permission: NAV_PERMISSIONS.users },
  { href: "/settings", label: "Settings", icon: Settings, permission: NAV_PERMISSIONS.settings },
];
