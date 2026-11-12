import { createNavigation } from "next-intl/navigation";
import { type ComponentProps, createElement } from "react";
import { LinkPending } from "@/components/shell/link-pending";
import { routing } from "./routing";

const navigation = createNavigation(routing);
export const { redirect, usePathname, useRouter, getPathname } = navigation;

/**
 * next-intl's Link, which also says while its navigation is pending, with the page it opens (shell/NavigationLoading
 * shows the page loader while that page is prepared).
 */
export function Link({ children, ...props }: ComponentProps<typeof navigation.Link>) {
  const { href } = props;
  const to = (typeof href === "string" ? href : (href.pathname ?? "")).split(/[?#]/)[0] ?? "";
  return createElement(navigation.Link, props, children, createElement(LinkPending, { to }));
}
