import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({session:{sub:"account"} as {sub:string}|null,profile:vi.fn()}));
vi.mock("@/lib/auth",()=>({sessionFromRequest:()=>mocks.session,requirePageSession:async()=>mocks.session}));
vi.mock("@/lib/profile",()=>({getProfile:mocks.profile}));
import { authorizeAdmin } from "@/lib/admin-auth";
beforeEach(()=>{mocks.session={sub:"account"};mocks.profile.mockReset();});
describe("server admin authorization",()=>{
  it("rejects anonymous access",async()=>{mocks.session=null;expect((await authorizeAdmin(new Request("http://localhost"))).response?.status).toBe(401);});
  it.each([undefined,"user"])("denies the default or regular role (%s)",async(role)=>{mocks.profile.mockResolvedValue({role});expect((await authorizeAdmin(new Request("http://localhost"))).response?.status).toBe(403);});
  it("checks the database role on every request and honors a revoked role",async()=>{
    mocks.profile.mockResolvedValueOnce({role:"admin"}).mockResolvedValueOnce({role:"user"});
    expect((await authorizeAdmin(new Request("http://localhost"))).session?.sub).toBe("account");
    expect((await authorizeAdmin(new Request("http://localhost"))).response?.status).toBe(403);
    expect(mocks.profile).toHaveBeenCalledTimes(2);
  });
  it("denies access when permission storage is unavailable",async()=>{mocks.profile.mockRejectedValue(new Error("offline"));expect((await authorizeAdmin(new Request("http://localhost"))).response?.status).toBe(503);});
});
