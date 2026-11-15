import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Center } from "@astryxdesign/core/Center";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TenantLayout } from "./components/TenantLayout";
import { RootLayout } from "./components/RouterLink";
import { HomePage } from "./pages/Home";
import { ServicesPage } from "./pages/Services";
import { BookPage } from "./pages/Book";
import { MyBookingPage } from "./pages/MyBooking";
import { NotFound } from "./pages/NotFound";

// Кабинет владельца загружается отдельно, чтобы не утяжелять страницу для клиентов.
const AdminApp = lazy(() => import("./admin/AdminApp"));

const defaultTenant = (import.meta.env.VITE_DEFAULT_TENANT as string) || "soker";

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <Navigate to={`/s/${defaultTenant}/`} replace /> },
      {
        path: "/s/:slug/admin/*",
        element: (
          <Suspense fallback={<Center height="100dvh"><Spinner size="xl" /></Center>}>
            <AdminApp />
          </Suspense>
        ),
      },
      {
        path: "/s/:slug",
        element: <TenantLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "services", element: <ServicesPage /> },
          { path: "book", element: <BookPage /> },
          { path: "my", element: <MyBookingPage /> },
          { path: "*", element: <NotFound /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
], { basename: import.meta.env.BASE_URL });

export function AppRouter() {
  return <RouterProvider router={router} />;
}
