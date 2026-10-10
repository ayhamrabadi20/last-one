import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({session:vi.fn(),findOne:vi.fn(),updateOne:vi.fn()}));
vi.mock("@/lib/auth",()=>({sessionFromRequest:m.session}));
vi.mock("@/lib/mongodb",()=>({requireDatabase:async()=>({collection:()=>m})}));
import { GET, PATCH } from "@/app/api/preferences/route";
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({sub:"person@example.com"});m.findOne.mockResolvedValue({theme:"dark"});m.updateOne.mockResolvedValue({matchedCount:1});});
describe("account appearance preferences",()=>{
 it("loads the authenticated account preference",async()=>{expect(await (await GET(new Request("http://localhost/api/preferences"))).json()).toEqual({theme:"dark"});});
 it("rejects unsupported modes without writing",async()=>{expect((await PATCH(new Request("http://localhost/api/preferences",{method:"PATCH",body:JSON.stringify({theme:"custom"})}))).status).toBe(400);expect(m.updateOne).not.toHaveBeenCalled();});
 it("saves only to the authenticated identity",async()=>{expect((await PATCH(new Request("http://localhost/api/preferences",{method:"PATCH",body:JSON.stringify({theme:"light",email:"other@example.com"})}))).status).toBe(200);expect(m.updateOne.mock.calls[0][0].$or).toEqual([{email:"person@example.com"},{username:"person@example.com"}]);});
 it("requires an active authenticated session",async()=>{m.session.mockResolvedValue(null);expect((await GET(new Request("http://localhost/api/preferences"))).status).toBe(401);});
});
