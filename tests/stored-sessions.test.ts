import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
const m=vi.hoisted(()=>({account:vi.fn(),session:vi.fn()}));
vi.mock("@/lib/mongodb",()=>({requireDatabase:async()=>({collection:(name:string)=>({findOne:name==="accounts"?m.account:m.session})})}));
vi.mock("next/headers",()=>({cookies:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
import { createSessionToken, sessionFromRequest } from "@/lib/auth";
const id=new ObjectId().toString();
const request=(token=createSessionToken("person@example.com",id,2))=>new Request("http://localhost/api/profile",{headers:{cookie:`lifeevent_session=${token}`}});
beforeEach(()=>{vi.clearAllMocks();m.account.mockResolvedValue({email:"person@example.com",status:"active",sessionVersion:2});m.session.mockResolvedValue({accountId:id});});
describe("stored session validation",()=>{
 it("accepts an active account with a stored session",async()=>{expect((await sessionFromRequest(request()))?.sub).toBe("person@example.com");});
 it("rejects a banned account even when the signed token remains valid",async()=>{m.account.mockResolvedValue({email:"person@example.com",status:"banned",sessionVersion:2});expect(await sessionFromRequest(request())).toBeNull();});
 it("rejects revoked and deleted sessions",async()=>{m.session.mockResolvedValue(null);expect(await sessionFromRequest(request())).toBeNull();});
 it("rejects an older session version after a password or role change",async()=>{expect(await sessionFromRequest(request(createSessionToken("person@example.com",id,1)))).toBeNull();});
 it("does not let a recreated email inherit a deleted account token",async()=>{m.account.mockResolvedValue(null);expect(await sessionFromRequest(request())).toBeNull();});
 it("fails closed when storage is unavailable",async()=>{m.account.mockRejectedValue(new Error("offline"));expect(await sessionFromRequest(request())).toBeNull();});
});
