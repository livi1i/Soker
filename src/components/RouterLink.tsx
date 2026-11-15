import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link, Outlet } from "react-router";
import { LinkProvider } from "@astryxdesign/core/Link";

/** Внутренние ссылки Astryx (Button/Link с href) переходят без перезагрузки страницы. */
const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }>(
  function RouterLink({ href = "", ...rest }, ref) {
    const internal = href.startsWith("/") && !href.startsWith("//") && !rest.target && !rest.download;
    if (internal) return <Link ref={ref} to={href} viewTransition {...rest} />;
    return <a ref={ref} href={href} {...rest} />;
  },
);

export function RootLayout() {
  return (
    <LinkProvider component={RouterLink as never}>
      <Outlet />
    </LinkProvider>
  );
}
