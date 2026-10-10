export type AdminUser = { id: string; name: string; email: string; phone: string; username?: string; role: "admin" | "user"; status: "active" | "suspended" | "banned" | "deleted"; protectedAdmin: boolean; createdAt: string | null };
export type AdminReply = { text: string; createdAt: string };
export type AdminTicket = { id: string; subject: string; message: string; category: string; status: string; context?: string; interactionId?: string; userId: string; contact?: {name:string;email:string}; createdAt: string; replies: AdminReply[] };
export type AdminAudit = { id:string; actor:string; action:string; targetId:string; status:string; createdAt:string };
export type AdminOverview = { totals: { users:number; admins:number; newUsers:number; requests:number; activeUsers:number; openTickets:number; resolvedTickets:number; checklists:number }; trend: Array<{ date:string; users:number; requests:number }>; requestTypes: Array<{type:string;count:number}>; recentUsers: AdminUser[]; recentTickets: AdminTicket[]; updatedAt:string };
export type AdminList<T> = { items:T[]; total:number; page:number; pages:number };
