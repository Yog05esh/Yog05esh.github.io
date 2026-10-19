import { recordedAccountParams } from "@/lib/static-params";
import AccountPageClient from "./AccountPageClient";

/** Static export needs every client-side route known at build time. */
export function generateStaticParams() { return recordedAccountParams(); }

export default function AccountPage() { return <AccountPageClient />; }
