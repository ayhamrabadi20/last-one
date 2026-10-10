import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
const m=vi.hoisted(()=>({createIndex:vi.fn(),findOneAndUpdate:vi.fn()}));
vi.mock("@/lib/mongodb",()=>({mongoConfigured:()=>true,getDatabase:async()=>({collection:()=>m})}));
import { saveInteraction } from "@/lib/interaction-history";
beforeEach(()=>{vi.clearAllMocks();m.findOneAndUpdate.mockResolvedValue({_id:new ObjectId()});});
describe("one saved record per logical request",()=>{
 it("uses the same account and request key across intake and final plan",async()=>{await saveInteraction({userId:"user",requestKey:"flow",type:"intake",input:"my project",response:{nextQuestion:"location"}});await saveInteraction({userId:"user",requestKey:"flow",type:"exploration",input:"my project",response:{steps:[]}});expect(m.findOneAndUpdate.mock.calls[0][0]).toEqual(m.findOneAndUpdate.mock.calls[1][0]);expect(m.findOneAndUpdate.mock.calls[1][1].$set.type).toBe("exploration");expect(m.findOneAndUpdate.mock.calls[1][2].upsert).toBe(true);});
 it("deduplicates repeated requests without an explicit workflow key",async()=>{const entry={userId:"user",type:"journey" as const,input:"same state",response:{}};await saveInteraction(entry);await saveInteraction(entry);expect(m.findOneAndUpdate.mock.calls[0][0]).toEqual(m.findOneAndUpdate.mock.calls[1][0]);});
 it("isolates identical request keys between accounts",async()=>{await saveInteraction({userId:"a",requestKey:"flow",type:"intake",input:"goal",response:{}});await saveInteraction({userId:"b",requestKey:"flow",type:"intake",input:"goal",response:{}});expect(m.findOneAndUpdate.mock.calls[0][0]).not.toEqual(m.findOneAndUpdate.mock.calls[1][0]);});
 it("recovers from a concurrent upsert collision without inserting again",async()=>{m.findOneAndUpdate.mockRejectedValueOnce({code:11000});expect((await saveInteraction({userId:"a",type:"journey",input:"goal",response:{}})).saved).toBe(true);expect(m.findOneAndUpdate.mock.calls[1][2].upsert).toBeUndefined();});
});
