import { recordedIncidentParams } from "@/lib/static-params";
import IncidentPageClient from "./IncidentPageClient";

/** Static export needs every client-side route known at build time. */
export function generateStaticParams() { return recordedIncidentParams(); }

export default function IncidentPage() { return <IncidentPageClient />; }
