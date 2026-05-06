// client/src/components/ui/KpiCard.tsx
import { LucideIcon } from 'lucide-react'
export default function KpiCard({icon:Icon,label,value,sub}:{icon:LucideIcon;label:string;value:string|number;sub:string}){return <div className="sf-card p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{label}</p><h3 className="mt-2 text-3xl font-black">{value}</h3></div><div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><Icon size={24}/></div></div><p className="mt-3 text-sm text-slate-500">{sub}</p></div>}
