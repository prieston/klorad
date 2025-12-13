import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { ClientProviders } from "./providers";

export const metadata = {
  title: "Klorad | Viewer",
  description: "Preview published worlds.",
  icons: { icon: "/klorad-favicon.png" },
};

export const dynamic = "force-dynamic";

export default function PublicLayout({ children }) {
  return (
    <>
      <ClientProviders>{children}</ClientProviders>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        theme="dark"
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
      />
    </>
  );
}
