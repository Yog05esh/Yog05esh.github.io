import { recordedIncidentParams } from "@/lib/static-params";
import CaseAliasClient from "./CaseAliasClient";

export function generateStaticParams() { return recordedIncidentParams(); }

export default function CaseAliasPage() { return <CaseAliasClient />; }
