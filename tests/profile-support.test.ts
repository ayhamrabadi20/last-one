import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
const mocks = vi.hoisted(() => ({ session: { sub: "owner" } as {sub:string}|null, profile: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(), countDocuments: vi.fn(), find: vi.fn(), createIndex: vi.fn() }));
vi.mock("@/lib/auth", () => ({ sessionFromRequest: () => mocks.session }));
vi.mock("@/lib/profile", () => ({ getProfile: mocks.profile }));
vi.mock("@/lib/mongodb", () => ({ requireDatabase: async () => ({ collection: () => mocks }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({allowed:true}), requestKey: () => "test" }));
import { GET as profileGET, PATCH } from "@/app/api/profile/route";
import { GET as supportGET, POST } from "@/app/api/support/route";
beforeEach(() => {
  vi.clearAllMocks(); mocks.session = { sub: "owner" };
  mocks.profile.mockResolvedValue({name:"Owner",email:"owner@example.com",phone:"0791234567"});
  mocks.countDocuments.mockResolvedValue(2);
  mocks.updateOne.mockResolvedValue({matchedCount:1});
  mocks.insertOne.mockResolvedValue({insertedId:new ObjectId()});
  mocks.findOne.mockResolvedValue(null);
  const cursor={sort:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),toArray:vi.fn().mockResolvedValue([])};
  mocks.find.mockReturnValue(cursor);
});
describe("account profile and support ownership", () => {
  it("uses the session account for profile and counts", async () => {
    const response=await profileGET(new Request("http://localhost/api/profile?userId=other"));
    expect(response.status).toBe(200);
    expect(mocks.profile).toHaveBeenCalledWith("owner");
    expect(mocks.countDocuments).toHaveBeenCalledWith({userId:"owner"});
  });
  it("updates only allowed profile fields under the session identity", async () => {
    const response=await PATCH(new Request("http://localhost/api/profile",{method:"PATCH",body:JSON.stringify({name:"New Name",phone:"0791234567",email:"attacker@example.com",userId:"other",passwordHash:"fake"})}));
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith({$or:[{email:"owner"},{username:"owner"}]},{$set:{name:"New Name",phone:"0791234567"}});
  });
  it("saves a support message with trusted contact and identity", async () => {
    const response=await POST(new Request("http://localhost/api/support",{method:"POST",body:JSON.stringify({subject:"Wrong answer",message:"The answer does not match my project",category:"answer",userId:"other",status:"resolved",contact:{email:"fake"}})}));
    expect(response.status).toBe(201);
    const ticket=mocks.insertOne.mock.calls[0][0];
    expect(ticket.userId).toBe("owner"); expect(ticket.status).toBe("new"); expect(ticket.contact.email).toBe("owner@example.com");
  });
  it("rejects linking a ticket to another user's request", async () => {
    const id=new ObjectId().toString();
    const response=await POST(new Request("http://localhost/api/support",{method:"POST",body:JSON.stringify({subject:"Wrong answer",message:"The answer does not match my project",category:"answer",interactionId:id})}));
    expect(response.status).toBe(400);
    expect(mocks.findOne).toHaveBeenCalledWith({_id:new ObjectId(id),userId:"owner"});
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it("lists only the owner's support tickets", async () => {
    expect((await supportGET(new Request("http://localhost/api/support?userId=other"))).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith({userId:"owner"});
  });
  it("rejects anonymous reads and writes", async () => {
    mocks.session=null;
    const request=new Request("http://localhost/api/profile");
    expect((await profileGET(request)).status).toBe(401); expect((await PATCH(request)).status).toBe(401);
    expect((await supportGET(request)).status).toBe(401); expect((await POST(request)).status).toBe(401);
  });
});
