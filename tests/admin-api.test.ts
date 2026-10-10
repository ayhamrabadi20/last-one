import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
const mocks=vi.hoisted(()=>({authorize:vi.fn(),collection:vi.fn(),find:vi.fn(),findOne:vi.fn(),countDocuments:vi.fn(),insertOne:vi.fn(),updateOne:vi.fn(),aggregate:vi.fn()}));
vi.mock("@/lib/admin-auth",()=>({authorizeAdmin:mocks.authorize}));
vi.mock("@/lib/mongodb",()=>({requireDatabase:async()=>({collection:mocks.collection})}));
vi.mock("@/lib/rate-limit",()=>({rateLimit:()=>({allowed:true}),requestKey:()=>"test"}));
import {GET,PATCH} from "@/app/api/admin/route";
beforeEach(()=>{
  vi.clearAllMocks();mocks.authorize.mockResolvedValue({session:{sub:"admin"},profile:{role:"admin"}});mocks.collection.mockReturnValue(mocks);
  mocks.countDocuments.mockResolvedValue(1);mocks.findOne.mockResolvedValue({_id:new ObjectId()});mocks.insertOne.mockResolvedValue({insertedId:new ObjectId()});mocks.updateOne.mockResolvedValue({matchedCount:1});
  const cursor={sort:vi.fn().mockReturnThis(),skip:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),toArray:vi.fn().mockResolvedValue([{_id:new ObjectId(),name:"User",email:"user@example.com",phone:"0791234567",passwordHash:"private-secret",resetHash:"private-reset",role:"user",createdAt:new Date()}])};
  mocks.find.mockReturnValue(cursor);mocks.aggregate.mockReturnValue({toArray:vi.fn().mockResolvedValue([])});
});
describe("admin API",()=>{
  it("does not query data when authorization rejects the request",async()=>{
    mocks.authorize.mockResolvedValue({response:new Response(null,{status:403})});
    expect((await GET(new Request("http://localhost/api/admin"))).status).toBe(403);
    expect((await PATCH(new Request("http://localhost/api/admin",{method:"PATCH"}))).status).toBe(403);
    expect(mocks.collection).not.toHaveBeenCalled();
  });
  it("paginates user searches and never serializes password or reset fields",async()=>{
    const response=await GET(new Request("http://localhost/api/admin?view=users&page=2&search=user%2Bname"));
    const body=await response.json();expect(response.status).toBe(200);expect(body.page).toBe(2);expect(JSON.stringify(body)).not.toContain("private");
    const [filter,options]=mocks.find.mock.calls[0];expect(filter.$or[0].name.$regex).toBe("user\\+name");expect(options.projection.passwordHash).toBeUndefined();
    expect(mocks.find.mock.results[0].value.skip).toHaveBeenCalledWith(20);
  });
  it("validates pagination rather than accepting unbounded or negative values",async()=>{expect((await GET(new Request("http://localhost/api/admin?view=users&page=-1"))).status).toBe(400);});
  it("stores a support reply using the trusted admin identity and records the action",async()=>{
    const id=new ObjectId().toString();
    const response=await PATCH(new Request("http://localhost/api/admin",{method:"PATCH",body:JSON.stringify({id,status:"resolved",reply:"Please try the new project plan.",adminId:"fake"})}));
    expect(response.status).toBe(200);
    expect(mocks.insertOne.mock.calls[0][0].actor).toBe("admin");
    expect(mocks.updateOne.mock.calls[0][1].$push.replies.adminId).toBe("admin");
    expect(mocks.updateOne.mock.calls[1][1].$set.status).toBe("completed");
  });
  it("rejects cross-origin admin mutations",async()=>{
    const response=await PATCH(new Request("http://localhost/api/admin",{method:"PATCH",headers:{origin:"https://other.example"},body:"{}"}));expect(response.status).toBe(403);expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
