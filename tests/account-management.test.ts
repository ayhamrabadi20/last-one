import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
const m=vi.hoisted(()=>({authorize:vi.fn(),findOne:vi.fn(),countDocuments:vi.fn(),updateOne:vi.fn(),insertOne:vi.fn(),deleteMany:vi.fn(),deleteOne:vi.fn()}));
vi.mock("@/lib/admin-auth",()=>({authorizeAdmin:m.authorize}));
vi.mock("@/lib/mongodb",()=>({requireDatabase:async()=>({collection:()=>m})}));
vi.mock("@/lib/rate-limit",()=>({rateLimit:()=>({allowed:true}),requestKey:()=>"test"}));
import { POST } from "@/app/api/admin/users/route";
const id=new ObjectId();
const send=(action:string,extra={})=>POST(new Request("http://localhost/api/admin/users",{method:"POST",body:JSON.stringify({id:id.toString(),action,...extra})}));
beforeEach(()=>{vi.clearAllMocks();m.authorize.mockResolvedValue({session:{sub:"admin"}});m.findOne.mockResolvedValue({_id:id,email:"person@example.com",role:"user"});m.countDocuments.mockResolvedValue(2);m.updateOne.mockResolvedValue({matchedCount:1});m.insertOne.mockResolvedValue({insertedId:new ObjectId()});});
describe("account management safety",()=>{
  it("rejects ordinary users before any database mutation",async()=>{m.authorize.mockResolvedValue({response:new Response(null,{status:403})});expect((await send("ban")).status).toBe(403);expect(m.updateOne).not.toHaveBeenCalled();});
  it("protects the primary administrator",async()=>{m.findOne.mockResolvedValue({_id:id,protectedAdmin:true});expect((await send("delete")).status).toBe(409);expect(m.insertOne).not.toHaveBeenCalled();});
  it("prevents removing the last active administrator",async()=>{m.findOne.mockResolvedValue({_id:id,email:"other@example.com",role:"admin"});m.countDocuments.mockResolvedValue(1);expect((await send("role",{role:"user"})).status).toBe(409);});
  it("bans an account and revokes all existing sessions",async()=>{expect((await send("ban")).status).toBe(200);expect(m.updateOne.mock.calls[0][1].$set.status).toBe("banned");expect(m.updateOne.mock.calls[0][1].$inc.sessionVersion).toBe(1);expect(m.deleteMany).toHaveBeenCalledWith({accountId:id.toString()});});
  it("requires the exact email before irreversible deletion",async()=>{expect((await send("delete",{confirmation:"wrong"})).status).toBe(400);expect(m.deleteOne).not.toHaveBeenCalled();});
  it("removes owned records before deleting the account",async()=>{expect((await send("delete",{confirmation:"person@example.com"})).status).toBe(200);expect(m.deleteMany).toHaveBeenCalledTimes(4);expect(m.deleteOne).toHaveBeenCalledWith({_id:id,status:"deleted",protectedAdmin:{$ne:true}});expect(m.updateOne.mock.calls.at(-1)?.[1].$set.status).toBe("completed");});
  it("only accepts the supported roles",async()=>{expect((await send("role",{role:"superadmin"})).status).toBe(400);expect(m.updateOne).not.toHaveBeenCalled();});
});
